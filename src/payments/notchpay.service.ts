import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class NotchPayService {
  private readonly logger = new Logger(NotchPayService.name);
  private readonly publicKey: string;
  private readonly privateKey: string;
  private readonly baseUrl = 'https://api.notchpay.co';

  constructor(private config: ConfigService) {
    this.publicKey = this.config.get('NOTCHPAY_PUBLIC_KEY') || '';
    this.privateKey = this.config.get('NOTCHPAY_PRIVATE_KEY') || '';
  }

  async initiatePayment(amount: number, phone: string, orderId: string, method: string) {
    const reference = `NYAMA-${orderId}-${Date.now()}`;
    try {
      const response = await fetch(`${this.baseUrl}/payments`, {
        method: 'POST',
        headers: {
          'Authorization': this.publicKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount,
          currency: 'XAF',
          phone,
          reference,
          description: `Commande NYAMA #${orderId}`,
          channel: method === 'MTN_MOMO' ? 'cm.mobile' : method === 'ORANGE_MONEY' ? 'cm.orange' : 'cm.mobile',
        }),
      });
      const data = await response.json();
      this.logger.log(`Payment initiated: ${reference} → ${JSON.stringify(data)}`);
      return { reference, status: (data as any)?.transaction?.status || 'pending', raw: data };
    } catch (error: any) {
      this.logger.error(`Payment error: ${error.message}`);
      throw error;
    }
  }

  async verifyPayment(reference: string) {
    try {
      const response = await fetch(`${this.baseUrl}/payments/${reference}`, {
        headers: { 'Authorization': this.publicKey },
      });
      const data = await response.json();
      return {
        status: (data as any)?.transaction?.status,
        amount: (data as any)?.transaction?.amount,
        raw: data,
      };
    } catch (error: any) {
      this.logger.error(`Verify error: ${error.message}`);
      throw error;
    }
  }
}
