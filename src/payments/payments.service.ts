import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OrderStatus, PaymentMethod, PaymentStatus } from '@prisma/client';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { EventsService } from '../events/events.service';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';
import { NotchPayWebhookDto } from './dto/webhook.dto';
import { NotchPayService } from './notchpay.service';

// Backwards-compatible alias kept for other files that used to import it.
export type NotchPayWebhookPayload = NotchPayWebhookDto;

const PROVIDER_TO_METHOD: Record<string, PaymentMethod> = {
  mtn: PaymentMethod.MTN_MOMO,
  orange: PaymentMethod.ORANGE_MONEY,
};

// Re-poll NotchPay if a payment stays pending for longer than this (ms)
const STALE_PENDING_MS = 30_000;

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly events: EventsService,
    private readonly notchPay: NotchPayService,
  ) {}

  async initiate(clientId: string, dto: InitiatePaymentDto) {
    const method = PROVIDER_TO_METHOD[dto.provider];
    if (!method) {
      throw new BadRequestException(
        "Méthode de paiement non supportée. Le paiement en espèces n'est pas accepté.",
      );
    }

    const order = await this.prisma.order.findUnique({
      where: { id: dto.orderId },
      include: {
        client: { select: { id: true, name: true, email: true } },
        payment: true,
      },
    });
    if (!order) throw new NotFoundException('Commande introuvable');
    if (order.clientId !== clientId) {
      throw new ForbiddenException('Cette commande ne vous appartient pas');
    }
    if (order.paymentStatus === PaymentStatus.SUCCESS) {
      throw new BadRequestException('Cette commande est déjà payée');
    }

    const amountXaf =
      order.payment?.amountXaf ?? order.totalXaf + order.deliveryFeeXaf;

    const initResult = await this.notchPay.initiatePayment({
      amountXaf,
      phone: dto.phone,
      provider: dto.provider,
      orderId: order.id,
      customerName: order.client.name ?? 'Client NYAMA',
      customerEmail: order.client.email ?? 'customer@nyama.cm',
    });

    // Upsert: orders created before this feature may not have a Payment row.
    const payment = await this.prisma.payment.upsert({
      where: { orderId: order.id },
      create: {
        orderId: order.id,
        method,
        status: PaymentStatus.PENDING,
        amountXaf,
        phone: dto.phone,
        providerRef: initResult.reference,
        notchpayTrxRef: initResult.transactionRef,
        paymentUrl: initResult.paymentUrl,
      },
      update: {
        method,
        status: PaymentStatus.PENDING,
        phone: dto.phone,
        providerRef: initResult.reference,
        notchpayTrxRef: initResult.transactionRef,
        paymentUrl: initResult.paymentUrl,
        failureReason: null,
      },
    });

    // Keep Order.paymentMethod in sync with what the client actually picked.
    if (order.paymentMethod !== method) {
      await this.prisma.order.update({
        where: { id: order.id },
        data: { paymentMethod: method },
      });
    }

    return {
      success: true,
      paymentUrl: payment.paymentUrl,
      reference: payment.providerRef,
      paymentId: payment.id,
      status: payment.status,
    };
  }

  async getById(paymentId: string, userId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { order: { select: { clientId: true } } },
    });
    if (!payment) throw new NotFoundException('Paiement introuvable');
    if (payment.order.clientId !== userId) {
      throw new ForbiddenException('Accès non autorisé');
    }
    return this.refreshIfStale(payment);
  }

  async getByOrderId(orderId: string, userId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { orderId },
      include: { order: { select: { clientId: true } } },
    });
    if (!payment) throw new NotFoundException('Paiement introuvable');
    if (payment.order.clientId !== userId) {
      throw new ForbiddenException('Accès non autorisé');
    }
    return this.refreshIfStale(payment);
  }

  /**
   * Re-poll NotchPay for a pending payment that hasn't moved in >30s.
   * Webhooks are the primary update path; this is a safety net for clients
   * polling the GET endpoint when the webhook is delayed or lost.
   * Also self-heals Order rows that drifted out of sync with a terminal Payment.
   */
  private async refreshIfStale(payment: any) {
    if (payment.status !== PaymentStatus.PENDING) {
      await this.ensureOrderInSync(payment.orderId, payment.status);
      return this.prisma.payment.findUnique({ where: { id: payment.id } });
    }

    if (
      !payment.providerRef ||
      Date.now() - new Date(payment.updatedAt).getTime() < STALE_PENDING_MS
    ) {
      return payment;
    }

    try {
      const verified = await this.notchPay.verifyPayment(payment.providerRef);
      const mapped = this.mapProviderStatus(verified.status);
      if (mapped && mapped !== payment.status) {
        await this.applyTerminalStatus(payment.id, payment.orderId, mapped, {
          providerPayload: JSON.stringify(verified.raw),
        });
        return this.prisma.payment.findUnique({ where: { id: payment.id } });
      }
      // Touch updatedAt to dampen re-polling.
      return this.prisma.payment.update({
        where: { id: payment.id },
        data: { updatedAt: new Date() },
      });
    } catch (err: any) {
      this.logger.warn(`refreshIfStale failed ${payment.id}: ${err?.message}`);
      return payment;
    }
  }

  /**
   * Ensure the Order row reflects the Payment terminal status.
   * Used to heal drift when Payment was flipped without updating Order
   * (manual DB edit, historical code path, or interrupted webhook).
   */
  private async ensureOrderInSync(
    orderId: string,
    paymentStatus: PaymentStatus,
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        paymentStatus: true,
        clientId: true,
        cookId: true,
        totalXaf: true,
      },
    });
    if (!order) return;
    if (order.paymentStatus === paymentStatus) return;

    if (paymentStatus === PaymentStatus.SUCCESS) {
      await this.prisma.order.update({
        where: { id: orderId },
        data: {
          paymentStatus: PaymentStatus.SUCCESS,
          status: OrderStatus.CONFIRMED,
          acceptedAt: new Date(),
        },
      });
      this.logger.log(
        `📡 emit('payment:updated') → rooms: client-${order.clientId} | payload: status=SUCCESS orderId=${orderId}`,
      );
      this.events.notifyClient(order.clientId, 'payment:updated', {
        orderId,
        status: paymentStatus,
      });
      this.logger.log(
        `📡 emit('order:new') → rooms: cook-${order.cookId} | payload: orderId=${orderId} totalXaf=${order.totalXaf}`,
      );
      this.events.notifyCook(order.cookId, 'order:new', {
        orderId,
        totalXaf: order.totalXaf,
      });
      this.logger.log(
        `📡 emit('order:status') → rooms: order-${orderId}, cook-${order.cookId}, client-${order.clientId} | payload: status=CONFIRMED (sync from payment)`,
      );
      this.events.emitToOrderRoom(orderId, 'order:status', {
        orderId,
        status: OrderStatus.CONFIRMED,
      });
      this.events.notifyClient(order.clientId, 'order:status', {
        orderId,
        status: OrderStatus.CONFIRMED,
      });
      this.events.notifyCook(order.cookId, 'order:status', {
        orderId,
        status: OrderStatus.CONFIRMED,
      });
      this.logger.log(
        `Order ${orderId} synced to CONFIRMED/PAID from terminal Payment`,
      );
    } else if (paymentStatus === PaymentStatus.FAILED) {
      await this.prisma.order.update({
        where: { id: orderId },
        data: { paymentStatus: PaymentStatus.FAILED },
      });
      this.logger.log(
        `📡 emit('payment:updated') → rooms: client-${order.clientId} | payload: status=FAILED orderId=${orderId}`,
      );
      this.events.notifyClient(order.clientId, 'payment:updated', {
        orderId,
        status: paymentStatus,
      });
      this.logger.log(
        `📡 emit('payment:failed') → rooms: cook-${order.cookId} | payload: orderId=${orderId}`,
      );
      this.events.notifyCook(order.cookId, 'payment:failed', { orderId });
    }
  }

  verifySignature(rawBody: string, signature?: string) {
    const secret =
      this.config.get<string>('NOTCHPAY_WEBHOOK_SECRET') ??
      this.config.get<string>('NOTCHPAY_HASH');
    if (!secret) return; // dev / sandbox: no hash set
    if (!signature) throw new UnauthorizedException('Signature manquante');
    const expected = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');
    const ok =
      signature.length === expected.length &&
      crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
    if (!ok) throw new UnauthorizedException('Signature invalide');
  }

  async handleWebhook(payload: NotchPayWebhookDto) {
    const reference = payload?.data?.reference;
    const providerStatus = payload?.data?.status?.toLowerCase();
    if (!reference) {
      this.logger.warn('Webhook payload missing reference');
      return { success: false, reason: 'missing_reference' };
    }

    const payment = await this.prisma.payment.findFirst({
      where: { providerRef: reference },
    });
    if (!payment) {
      this.logger.warn(`Payment not found for reference=${reference}`);
      return { success: false, reason: 'payment_not_found' };
    }

    if (
      payment.status === PaymentStatus.SUCCESS ||
      payment.status === PaymentStatus.FAILED
    ) {
      return { success: true, reason: 'already_processed' };
    }

    const nextStatus = this.mapProviderStatus(providerStatus);
    if (!nextStatus || nextStatus === PaymentStatus.PENDING) {
      // Persist trxref if provided, but stay pending.
      if (payload?.data?.trxref && !payment.notchpayTrxRef) {
        await this.prisma.payment.update({
          where: { id: payment.id },
          data: { notchpayTrxRef: payload.data.trxref },
        });
      }
      return { success: true, reason: 'still_pending' };
    }

    await this.applyTerminalStatus(payment.id, payment.orderId, nextStatus, {
      providerPayload: JSON.stringify(payload),
      notchpayTrxRef: payload?.data?.trxref,
      failureReason:
        nextStatus === PaymentStatus.FAILED
          ? providerStatus ?? 'unknown'
          : null,
    });

    this.logger.log(
      `Webhook processed: ref=${reference} → ${nextStatus} (order=${payment.orderId})`,
    );
    return { success: true, status: nextStatus };
  }

  private mapProviderStatus(status?: string): PaymentStatus | undefined {
    if (!status) return undefined;
    const s = status.toLowerCase();
    if (s === 'complete' || s === 'completed' || s === 'success' || s === 'successful') {
      return PaymentStatus.SUCCESS;
    }
    if (
      s === 'failed' ||
      s === 'canceled' ||
      s === 'cancelled' ||
      s === 'expired' ||
      s === 'rejected'
    ) {
      return PaymentStatus.FAILED;
    }
    return PaymentStatus.PENDING;
  }

  private async applyTerminalStatus(
    paymentId: string,
    orderId: string,
    nextStatus: PaymentStatus,
    extra: {
      providerPayload?: string;
      notchpayTrxRef?: string;
      failureReason?: string | null;
    } = {},
  ) {
    await this.prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: paymentId },
        data: {
          status: nextStatus,
          paidAt: nextStatus === PaymentStatus.SUCCESS ? new Date() : null,
          ...(extra.providerPayload
            ? { providerPayload: extra.providerPayload }
            : {}),
          ...(extra.notchpayTrxRef
            ? { notchpayTrxRef: extra.notchpayTrxRef }
            : {}),
          failureReason: extra.failureReason ?? null,
        },
      });

      if (nextStatus === PaymentStatus.SUCCESS) {
        await tx.order.update({
          where: { id: orderId },
          data: {
            paymentStatus: PaymentStatus.SUCCESS,
            status: OrderStatus.CONFIRMED,
            acceptedAt: new Date(),
          },
        });
      } else {
        await tx.order.update({
          where: { id: orderId },
          data: { paymentStatus: PaymentStatus.FAILED },
        });
      }
    });

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { clientId: true, cookId: true, totalXaf: true },
    });
    if (order) {
      this.logger.log(
        `📡 emit('payment:updated') → rooms: client-${order.clientId} | payload: status=${nextStatus} orderId=${orderId}`,
      );
      this.events.notifyClient(order.clientId, 'payment:updated', {
        orderId,
        status: nextStatus,
      });
      if (nextStatus === PaymentStatus.SUCCESS) {
        this.logger.log(
          `📡 emit('order:new') → rooms: cook-${order.cookId} | payload: orderId=${orderId} totalXaf=${order.totalXaf}`,
        );
        this.events.notifyCook(order.cookId, 'order:new', {
          orderId,
          totalXaf: order.totalXaf,
        });
        this.logger.log(
          `📡 emit('order:status') → rooms: order-${orderId}, cook-${order.cookId}, client-${order.clientId} | payload: status=CONFIRMED (after payment success)`,
        );
        this.events.emitToOrderRoom(orderId, 'order:status', {
          orderId,
          status: OrderStatus.CONFIRMED,
        });
        this.events.notifyClient(order.clientId, 'order:status', {
          orderId,
          status: OrderStatus.CONFIRMED,
        });
        this.events.notifyCook(order.cookId, 'order:status', {
          orderId,
          status: OrderStatus.CONFIRMED,
        });
      } else {
        this.logger.log(
          `📡 emit('payment:failed') → rooms: cook-${order.cookId} | payload: orderId=${orderId}`,
        );
        this.events.notifyCook(order.cookId, 'payment:failed', { orderId });
      }
    }
  }

  /**
   * Sandbox-only shortcut that bypasses NotchPay and flips a Payment to SUCCESS.
   * Gated by NOTCHPAY_PUBLIC_KEY containing "test" or NODE_ENV !== 'production'.
   */
  async testComplete(paymentId: string) {
    const publicKey = this.config.get<string>('NOTCHPAY_PUBLIC_KEY') ?? '';
    const nodeEnv = this.config.get<string>('NODE_ENV') ?? 'development';
    const isSandbox =
      publicKey.toLowerCase().includes('test') || nodeEnv !== 'production';
    if (!isSandbox) {
      throw new ForbiddenException(
        'test-complete est désactivé en production',
      );
    }

    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
    });
    if (!payment) throw new NotFoundException('Paiement introuvable');

    if (payment.status === PaymentStatus.SUCCESS) {
      await this.ensureOrderInSync(payment.orderId, PaymentStatus.SUCCESS);
      return this.prisma.payment.findUnique({ where: { id: paymentId } });
    }

    await this.applyTerminalStatus(
      payment.id,
      payment.orderId,
      PaymentStatus.SUCCESS,
      {
        providerPayload: JSON.stringify({ test: 'forced completion' }),
        failureReason: null,
      },
    );
    this.logger.log(
      `Payment ${paymentId} forced to SUCCESS via test-complete (order=${payment.orderId})`,
    );
    return this.prisma.payment.findUnique({ where: { id: paymentId } });
  }

  /** Retained for backwards compatibility with existing callers. */
  async attachProviderRef(orderId: string, reference: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { orderId },
    });
    if (!payment) throw new NotFoundException('Payment introuvable');
    return this.prisma.payment.update({
      where: { id: payment.id },
      data: { providerRef: reference },
    });
  }
}
