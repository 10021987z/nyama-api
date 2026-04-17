import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

export interface NotchPayInitiateParams {
  amountXaf: number;
  phone: string;
  provider: 'mtn' | 'orange' | 'cash';
  orderId: string;
  customerName?: string;
  customerEmail?: string;
  description?: string;
}

export interface NotchPayInitiateResult {
  reference: string;
  transactionRef?: string;
  paymentUrl?: string;
  status: string;
  raw: unknown;
}

const CHANNEL_BY_PROVIDER: Record<string, string> = {
  mtn: 'cm.mtn',
  orange: 'cm.orange',
};

@Injectable()
export class NotchPayService {
  private readonly logger = new Logger(NotchPayService.name);
  private readonly publicKey: string;
  private readonly secretKey: string;
  private readonly callbackUrl: string;
  private readonly client: AxiosInstance;

  constructor(private readonly config: ConfigService) {
    this.publicKey = this.config.get<string>('NOTCHPAY_PUBLIC_KEY') ?? '';
    this.secretKey =
      this.config.get<string>('NOTCHPAY_SECRET_KEY') ??
      this.config.get<string>('NOTCHPAY_PRIVATE_KEY') ??
      '';
    this.callbackUrl =
      this.config.get<string>('NOTCHPAY_WEBHOOK_URL') ?? '';

    this.client = axios.create({
      baseURL: 'https://api.notchpay.co',
      timeout: 15000,
      headers: {
        Authorization: this.publicKey,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    });
  }

  async initiatePayment(
    params: NotchPayInitiateParams,
  ): Promise<NotchPayInitiateResult> {
    const reference = `nyama_${params.orderId}_${Date.now()}`;
    const channel = CHANNEL_BY_PROVIDER[params.provider];

    const body: Record<string, unknown> = {
      amount: params.amountXaf,
      currency: 'XAF',
      description: params.description ?? `Commande NYAMA #${params.orderId}`,
      reference,
      customer: {
        email: params.customerEmail ?? 'customer@nyama.cm',
        phone: params.phone,
        name: params.customerName ?? 'Client NYAMA',
      },
      ...(this.callbackUrl ? { callback: this.callbackUrl } : {}),
      ...(channel ? { channels: [channel] } : {}),
    };

    try {
      const { data } = await this.client.post('/payments', body);
      const tx = (data as any)?.transaction ?? {};
      const paymentUrl =
        (data as any)?.authorization_url ??
        (data as any)?.authorizationUrl ??
        tx?.authorization_url ??
        undefined;

      return {
        reference: tx?.reference ?? reference,
        transactionRef: tx?.trxref ?? tx?.transaction_ref ?? undefined,
        paymentUrl,
        status: tx?.status ?? 'pending',
        raw: data,
      };
    } catch (err: any) {
      const detail = err?.response?.data ?? err?.message;
      this.logger.error(
        `NotchPay initiate failed ref=${reference}: ${JSON.stringify(detail)}`,
      );
      throw new InternalServerErrorException(
        'Échec de l\'initiation du paiement NotchPay',
      );
    }
  }

  async verifyPayment(reference: string) {
    try {
      const { data } = await this.client.get(
        `/payments/${encodeURIComponent(reference)}`,
      );
      const tx = (data as any)?.transaction ?? {};
      return {
        status: tx?.status as string | undefined,
        amount: tx?.amount as number | undefined,
        trxref: tx?.trxref as string | undefined,
        raw: data,
      };
    } catch (err: any) {
      const detail = err?.response?.data ?? err?.message;
      this.logger.warn(
        `NotchPay verify failed ref=${reference}: ${JSON.stringify(detail)}`,
      );
      throw new InternalServerErrorException(
        'Échec de la vérification du paiement NotchPay',
      );
    }
  }
}
