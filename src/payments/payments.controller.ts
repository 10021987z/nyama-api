import {
  Body,
  Controller,
  Get,
  HttpCode,
  Logger,
  Param,
  Post,
  Headers,
} from '@nestjs/common';
import {
  ClientPaymentMethod,
  PaymentsService,
} from './payments.service';

interface InitiatePaymentDto {
  orderId: string;
  amount: number;
  phone: string;
  method: ClientPaymentMethod;
}

interface NotchPayWebhookBody {
  event?: string;
  data?: {
    reference?: string;
    status?: string;
    amount?: number;
    phone?: string;
  };
}

@Controller('payments')
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name);

  constructor(private readonly payments: PaymentsService) {}

  @Post('initiate')
  async initiate(@Body() body: InitiatePaymentDto) {
    return this.payments.initiate({
      orderId: body.orderId,
      amount: body.amount,
      phone: body.phone,
      method: body.method,
    });
  }

  @Get(':reference')
  async verify(@Param('reference') reference: string) {
    return this.payments.verify(reference);
  }

  /**
   * Webhook NotchPay — doit TOUJOURS répondre 200, même en cas d'erreur
   * interne, pour éviter les retries agressifs du provider.
   *
   * Sécurité : si NOTCHPAY_WEBHOOK_SECRET est configuré, on vérifie le header
   * `x-notch-signature`. Dans tous les cas, on valide que la référence existe
   * bien en base (fallback documenté).
   */
  @Post('webhook/notchpay')
  @HttpCode(200)
  async webhook(
    @Body() body: NotchPayWebhookBody,
    @Headers('x-notch-signature') signature?: string,
  ) {
    try {
      const secret = process.env.NOTCHPAY_WEBHOOK_SECRET;
      if (secret && signature && signature !== secret) {
        this.logger.warn('Webhook signature invalide — ignoré');
        return { received: true };
      }

      await this.payments.handleWebhook(body.event ?? '', body.data ?? {});
    } catch (err) {
      this.logger.error(`Webhook error: ${(err as Error).message}`);
    }
    return { received: true };
  }
}
