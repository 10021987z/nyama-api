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
