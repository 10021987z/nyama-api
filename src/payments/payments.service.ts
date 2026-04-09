import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import {
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotchPayService } from './notchpay.service';

export type ClientPaymentMethod =
  | 'mtn_momo'
  | 'orange_money'
  | 'falla_mobile_money';

/**
 * Statuts exposés côté client/webhook NotchPay → enum Prisma interne.
 */
const STATUS_MAP: Record<string, PaymentStatus> = {
  complete: PaymentStatus.SUCCESS,
  completed: PaymentStatus.SUCCESS,
  success: PaymentStatus.SUCCESS,
  paid: PaymentStatus.SUCCESS,
  pending: PaymentStatus.PENDING,
  processing: PaymentStatus.PENDING,
  failed: PaymentStatus.FAILED,
  expired: PaymentStatus.FAILED,
  cancelled: PaymentStatus.FAILED,
};

const METHOD_MAP: Record<ClientPaymentMethod, PaymentMethod> = {
  mtn_momo: PaymentMethod.MTN_MOMO,
  orange_money: PaymentMethod.ORANGE_MONEY,
  falla_mobile_money: PaymentMethod.FALLA_MOMO,
};

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notchpay: NotchPayService,
  ) {}

  /**
   * Initie un paiement NotchPay pour une commande, et persiste la trace en base.
   */
  async initiate(params: {
    orderId: string;
    amount: number;
    phone: string;
    method: ClientPaymentMethod;
  }) {
    const { orderId, amount, phone, method } = params;

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { payment: true },
    });
    if (!order) throw new NotFoundException('Commande introuvable');

    const prismaMethod = METHOD_MAP[method];
    if (!prismaMethod) {
      throw new BadRequestException(`Méthode de paiement invalide : ${method}`);
    }

    // NotchPay
    const result = await this.notchpay.initiatePayment(amount, phone, orderId);

    // Upsert Payment (Order.payment est 1:1 via orderId @unique)
    const payment = await this.prisma.payment.upsert({
      where: { orderId },
      create: {
        orderId,
        method: prismaMethod,
        status: PaymentStatus.PENDING,
        amountXaf: amount,
        currency: 'XAF',
        providerRef: result.reference,
        providerPayload: JSON.stringify({ phone, raw: result.raw }),
      },
      update: {
        method: prismaMethod,
        status: PaymentStatus.PENDING,
        amountXaf: amount,
        providerRef: result.reference,
        providerPayload: JSON.stringify({ phone, raw: result.raw }),
        failureReason: null,
        paidAt: null,
      },
    });

    // Reflète la méthode/statut sur la commande
    await this.prisma.order.update({
      where: { id: orderId },
      data: {
        paymentMethod: prismaMethod,
        paymentStatus: PaymentStatus.PENDING,
      },
    });

    return {
      reference: payment.providerRef,
      status: 'pending',
      paymentId: payment.id,
    };
  }

  /**
   * Vérifie le statut d'un paiement auprès de NotchPay et synchronise la base.
   */
  async verify(reference: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { providerRef: reference },
    });
    if (!payment) throw new NotFoundException('Paiement introuvable');

    const remote = await this.notchpay.verifyPayment(reference);
    const newStatus = STATUS_MAP[remote.status] ?? PaymentStatus.PENDING;

    if (newStatus !== payment.status) {
      await this.applyStatus(payment.id, payment.orderId, newStatus);
    }

    return {
      reference,
      status: remote.status,
      amount: remote.amount,
    };
  }

  /**
   * Traite un événement webhook NotchPay de façon idempotente.
   * Toute erreur est loggée mais jamais renvoyée — le controller répond 200.
   */
  async handleWebhook(event: string, data: {
    reference?: string;
    status?: string;
    amount?: number;
    phone?: string;
  }) {
    if (!data?.reference) {
      this.logger.warn('Webhook sans reference — ignoré');
      return;
    }

    const payment = await this.prisma.payment.findUnique({
      where: { providerRef: data.reference },
    });
    if (!payment) {
      // Sécurité : on ignore silencieusement les références inconnues pour ne
      // pas donner d'info à un éventuel attaquant.
      this.logger.warn(`Webhook reference inconnue : ${data.reference}`);
      return;
    }

    let target: PaymentStatus | null = null;
    if (event === 'payment.complete' || data.status === 'complete') {
      target = PaymentStatus.SUCCESS;
    } else if (event === 'payment.failed' || data.status === 'failed') {
      target = PaymentStatus.FAILED;
    } else if (data.status && STATUS_MAP[data.status]) {
      target = STATUS_MAP[data.status];
    }

    if (!target) {
      this.logger.log(`Webhook ignoré (event=${event}, status=${data.status})`);
      return;
    }

    await this.applyStatus(payment.id, payment.orderId, target, {
      amount: data.amount,
      phone: data.phone,
      event,
    });
  }

  private async applyStatus(
    paymentId: string,
    orderId: string,
    status: PaymentStatus,
    extra?: Record<string, unknown>,
  ) {
    const now = new Date();
    await this.prisma.payment.update({
      where: { id: paymentId },
      data: {
        status,
        paidAt: status === PaymentStatus.SUCCESS ? now : null,
        failureReason:
          status === PaymentStatus.FAILED
            ? (extra?.event as string | undefined) ?? 'notchpay failure'
            : null,
        providerPayload: extra ? JSON.stringify(extra) : undefined,
      },
    });

    // Met à jour la commande
    if (status === PaymentStatus.SUCCESS) {
      await this.prisma.order.update({
        where: { id: orderId },
        data: {
          paymentStatus: PaymentStatus.SUCCESS,
          status: OrderStatus.CONFIRMED,
        },
      });
    } else if (status === PaymentStatus.FAILED) {
      // L'enum OrderStatus n'a pas de PAYMENT_FAILED — on garde la commande
      // en PENDING mais on marque paymentStatus=FAILED pour débloquer un
      // nouvel essai côté client.
      await this.prisma.order.update({
        where: { id: orderId },
        data: { paymentStatus: PaymentStatus.FAILED },
      });
    }
  }
}
