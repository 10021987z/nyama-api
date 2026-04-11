import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { NotchPayService } from './notchpay.service';
import {
  NotchPayWebhookPayload,
  PaymentsService,
} from './payments.service';

@Controller('payments')
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name);

  constructor(
    private readonly notchPayService: NotchPayService,
    private readonly paymentsService: PaymentsService,
  ) {}

  @Post('initiate')
  @UseGuards(JwtAuthGuard)
  async initiate(
    @Body()
    body: { orderId: string; amount: number; phone: string; method: string },
  ) {
    const result = await this.notchPayService.initiatePayment(
      body.amount,
      body.phone,
      body.orderId,
      body.method,
    );
    // Persist provider reference so the webhook can correlate
    if (result.reference) {
      await this.paymentsService
        .attachProviderRef(body.orderId, result.reference)
        .catch((e) =>
          this.logger.warn(`attachProviderRef failed: ${e?.message}`),
        );
    }
    return result;
  }

  @Get('verify/:reference')
  async verify(@Param('reference') reference: string) {
    return this.notchPayService.verifyPayment(reference);
  }

  @Post('webhook/notchpay')
  @HttpCode(HttpStatus.OK)
  async webhook(
    @Req() req: any,
    @Body() body: NotchPayWebhookPayload,
    @Headers('x-notch-signature') signature?: string,
  ) {
    // Raw body is attached by main.ts bodyParser config; fall back to JSON
    const rawBody: string =
      (req as any).rawBody?.toString?.() ?? JSON.stringify(body);
    try {
      this.paymentsService.verifySignature(rawBody, signature);
    } catch (err: any) {
      this.logger.warn(`Webhook signature rejected: ${err.message}`);
      return { ok: false, reason: 'invalid_signature' };
    }
    this.logger.log(
      `Webhook received: event=${body?.event} ref=${body?.data?.reference}`,
    );
    return this.paymentsService.handleWebhook(body);
  }
}
