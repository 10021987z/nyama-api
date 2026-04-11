import {
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OrderStatus, PaymentStatus } from '@prisma/client';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { EventsService } from '../events/events.service';

export interface NotchPayWebhookPayload {
  event?: string; // e.g. "payment.complete", "payment.failed"
  data?: {
    reference?: string;
    status?: string; // "complete" | "failed" | "pending" | "canceled"
    amount?: number;
    currency?: string;
    customer?: { phone?: string };
  };
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly events: EventsService,
  ) {}

  /**
   * Verify NotchPay webhook signature if a secret is configured.
   * NotchPay sends `x-notch-signature` — HMAC-SHA256 of the raw body.
   * If no hash secret is set (dev), we skip verification.
   */
  verifySignature(rawBody: string, signature?: string) {
    const secret = this.config.get<string>('NOTCHPAY_HASH');
    if (!secret) return; // dev mode
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

  /**
   * Process a NotchPay webhook. Idempotent — called once per event,
   * but repeated deliveries should not double-update.
   */
  async handleWebhook(payload: NotchPayWebhookPayload) {
    const reference = payload?.data?.reference;
    const status = payload?.data?.status?.toLowerCase();
    if (!reference) {
      this.logger.warn('Webhook payload missing reference');
      return { ok: false, reason: 'missing_reference' };
    }

    const payment = await this.prisma.payment.findFirst({
      where: { providerRef: reference },
    });
    if (!payment) {
      this.logger.warn(`Payment not found for reference=${reference}`);
      return { ok: false, reason: 'payment_not_found' };
    }

    // Idempotent: if already in a terminal state, noop
    if (
      payment.status === PaymentStatus.SUCCESS ||
      payment.status === PaymentStatus.FAILED
    ) {
      return { ok: true, reason: 'already_processed' };
    }

    const nextStatus =
      status === 'complete' || status === 'success'
        ? PaymentStatus.SUCCESS
        : status === 'failed' || status === 'canceled' || status === 'expired'
          ? PaymentStatus.FAILED
          : PaymentStatus.PENDING;

    if (nextStatus === PaymentStatus.PENDING) {
      return { ok: true, reason: 'still_pending' };
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: nextStatus,
          paidAt: nextStatus === PaymentStatus.SUCCESS ? new Date() : null,
          providerPayload: JSON.stringify(payload),
          failureReason:
            nextStatus === PaymentStatus.FAILED ? status ?? 'unknown' : null,
        },
      });

      if (nextStatus === PaymentStatus.SUCCESS) {
        await tx.order.update({
          where: { id: payment.orderId },
          data: {
            paymentStatus: PaymentStatus.SUCCESS,
            // Auto-confirm on successful payment so the cook sees it
            status: OrderStatus.CONFIRMED,
          },
        });
      } else {
        await tx.order.update({
          where: { id: payment.orderId },
          data: { paymentStatus: PaymentStatus.FAILED },
        });
      }
    });

    // Notify real-time listeners
    const order = await this.prisma.order.findUnique({
      where: { id: payment.orderId },
      select: { clientId: true, cookId: true, status: true, totalXaf: true },
    });
    if (order) {
      this.events.notifyClient(order.clientId, 'payment:updated', {
        orderId: payment.orderId,
        status: nextStatus,
      });
      if (nextStatus === PaymentStatus.SUCCESS) {
        this.events.notifyCook(order.cookId, 'order:new', {
          orderId: payment.orderId,
          totalXaf: order.totalXaf,
        });
      }
    }

    this.logger.log(
      `Webhook processed: ref=${reference} → ${nextStatus} (order=${payment.orderId})`,
    );
    return { ok: true, status: nextStatus };
  }

  /**
   * Persist the provider reference returned by NotchPay right after
   * initiatePayment so we can correlate future webhooks.
   */
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
