import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface NotchPayInitiateResult {
  reference: string;
  status: string;
  transactionId?: string;
  raw: unknown;
}

export interface NotchPayVerifyResult {
  status: string;
  amount: number;
  phone?: string;
  raw: unknown;
}

/**
 * Wrapper minimal autour de l'API NotchPay.
 *
 * Docs : https://api.notchpay.co
 *   POST /payments     → initier
 *   GET  /payments/:ref → vérifier
 */
@Injectable()
export class NotchPayService {
  private readonly logger = new Logger(NotchPayService.name);
  private readonly baseUrl = 'https://api.notchpay.co';
  private readonly callbackUrl =
    'https://nyama-api-production.up.railway.app/api/v1/payments/webhook/notchpay';

  constructor(private readonly config: ConfigService) {}

  private get publicKey(): string {
    return this.config.get<string>('NOTCHPAY_PUBLIC_KEY') ?? '';
  }

  private get isSandbox(): boolean {
    const v = this.config.get<string>('NOTCHPAY_SANDBOX') ?? 'false';
    return v === 'true' || v === '1';
  }

  private headers(): Record<string, string> {
    return {
      Authorization: this.publicKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
  }

  /**
   * Initie un paiement NotchPay. La référence est générée côté NYAMA pour
   * rester idempotente et facilement retrouvable en base.
   */
  async initiatePayment(
    amount: number,
    phone: string,
    orderId: string,
  ): Promise<NotchPayInitiateResult> {
    const reference = `NYAMA-${orderId}-${Date.now()}`;
    const body = {
      amount,
      currency: 'XAF',
      phone,
      description: `Commande NYAMA #${orderId}`,
      reference,
      callback: this.callbackUrl,
      sandbox: this.isSandbox,
    };

    try {
      const res = await fetch(`${this.baseUrl}/payments`, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify(body),
      });
      const json = (await res.json().catch(() => ({}))) as {
        transaction?: { reference?: string; status?: string; id?: string };
        message?: string;
      };

      if (!res.ok) {
        this.logger.error(
          `NotchPay initiate failed [${res.status}]: ${JSON.stringify(json)}`,
        );
        throw new Error(json.message ?? `NotchPay error ${res.status}`);
      }

      return {
        reference: json.transaction?.reference ?? reference,
        status: json.transaction?.status ?? 'pending',
        transactionId: json.transaction?.id,
        raw: json,
      };
    } catch (err) {
      this.logger.error(`initiatePayment error: ${(err as Error).message}`);
      throw err;
    }
  }

  /**
   * Vérifie le statut d'un paiement auprès de NotchPay.
   */
  async verifyPayment(reference: string): Promise<NotchPayVerifyResult> {
    const res = await fetch(
      `${this.baseUrl}/payments/${encodeURIComponent(reference)}`,
      { method: 'GET', headers: this.headers() },
    );
    const json = (await res.json().catch(() => ({}))) as {
      transaction?: {
        status?: string;
        amount?: number;
        phone?: string;
      };
      message?: string;
    };

    if (!res.ok) {
      this.logger.error(
        `NotchPay verify failed [${res.status}]: ${JSON.stringify(json)}`,
      );
      throw new Error(json.message ?? `NotchPay error ${res.status}`);
    }

    return {
      status: json.transaction?.status ?? 'pending',
      amount: Number(json.transaction?.amount ?? 0),
      phone: json.transaction?.phone,
      raw: json,
    };
  }
}
