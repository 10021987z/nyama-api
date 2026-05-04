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
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { NotchPayService } from './notchpay.service';
import { PaymentsService } from './payments.service';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';
import { NotchPayWebhookDto } from './dto/webhook.dto';

@Controller('payments')
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name);

  constructor(
    private readonly notchPayService: NotchPayService,
    private readonly paymentsService: PaymentsService,
  ) {}

  @Get('methods')
  getAcceptedMethods() {
    return { methods: ['MTN_MOMO', 'ORANGE_MONEY'] };
  }

  @Post('initiate')
  @UseGuards(JwtAuthGuard)
  async initiate(
    @CurrentUser() user: { id: string },
    @Body() dto: InitiatePaymentDto,
  ) {
    return this.paymentsService.initiate(user.id, dto);
  }

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async webhook(
    @Req() req: any,
    @Body() body: NotchPayWebhookDto,
    @Headers('x-notch-signature') signature?: string,
  ) {
    return this.handleWebhookCommon(req, body, signature);
  }

  // Alias — l'env Railway NOTCHPAY_WEBHOOK_URL pointe historiquement
  // sur /payments/webhook/notchpay. On expose les deux pour éviter une migration.
  @Post('webhook/notchpay')
  @HttpCode(HttpStatus.OK)
  async webhookNotchpay(
    @Req() req: any,
    @Body() body: NotchPayWebhookDto,
    @Headers('x-notch-signature') signature?: string,
  ) {
    return this.handleWebhookCommon(req, body, signature);
  }

  private async handleWebhookCommon(
    req: any,
    body: NotchPayWebhookDto,
    signature?: string,
  ) {
    const rawBody: string =
      (req as any).rawBody?.toString?.() ?? JSON.stringify(body);
    try {
      this.paymentsService.verifySignature(rawBody, signature);
    } catch (err: any) {
      this.logger.warn(`Webhook signature rejected: ${err.message}`);
      return { success: false, reason: 'invalid_signature' };
    }
    this.logger.log(
      `Webhook received: event=${body?.event} ref=${body?.data?.reference}`,
    );
    return this.paymentsService.handleWebhook(body);
  }

  /**
   * Redirect post-paiement (browser GET) — NotchPay redirige le client ici
   * après l'écran de paiement. Renvoie une page HTML minimale.
   */
  @Get('webhook')
  webhookRedirect(
    @Query('status') status: string | undefined,
    @Query('reference') reference: string | undefined,
    @Res() res: Response,
  ) {
    return this.sendRedirectPage(res, status, reference);
  }

  @Get('webhook/notchpay')
  webhookRedirectNotchpay(
    @Query('status') status: string | undefined,
    @Query('reference') reference: string | undefined,
    @Res() res: Response,
  ) {
    return this.sendRedirectPage(res, status, reference);
  }

  private sendRedirectPage(
    res: Response,
    status: string | undefined,
    reference: string | undefined,
  ) {
    this.logger.log(
      `Webhook redirect (browser): status=${status} ref=${reference}`,
    );
    const lower = (status ?? '').toLowerCase();
    const isOk = ['complete', 'completed', 'success', 'successful'].includes(
      lower,
    );
    const title = isOk ? 'Paiement confirmé' : 'Paiement non finalisé';
    const body = isOk
      ? "Votre paiement est confirmé. Vous pouvez fermer cette page et retourner à l'application NYAMA."
      : "Le paiement n'a pas abouti. Retournez à l'application NYAMA pour réessayer.";
    res
      .status(HttpStatus.OK)
      .type('text/html; charset=utf-8')
      .send(`<!doctype html>
<html lang="fr"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${title} — NYAMA</title>
<style>body{font-family:system-ui,-apple-system,sans-serif;background:#f9f7f3;color:#3D3D3D;margin:0;padding:40px 20px;text-align:center}h1{font-size:22px}p{font-size:15px;color:#666;max-width:380px;margin:12px auto}</style>
</head><body><h1>${title}</h1><p>${body}</p></body></html>`);
  }

  @Get('verify/:reference')
  @UseGuards(JwtAuthGuard)
  async verify(@Param('reference') reference: string) {
    return this.notchPayService.verifyPayment(reference);
  }

  @Get('order/:orderId')
  @UseGuards(JwtAuthGuard)
  async getByOrder(
    @CurrentUser() user: { id: string },
    @Param('orderId') orderId: string,
  ) {
    return this.paymentsService.getByOrderId(orderId, user.id);
  }

  @Get(':paymentId')
  @UseGuards(JwtAuthGuard)
  async getById(
    @CurrentUser() user: { id: string },
    @Param('paymentId') paymentId: string,
  ) {
    return this.paymentsService.getById(paymentId, user.id);
  }

  @Post(':paymentId/test-complete')
  @UseGuards(JwtAuthGuard)
  async testComplete(@Param('paymentId') paymentId: string) {
    return this.paymentsService.testComplete(paymentId);
  }
}
