import { Body, Controller, Get, Logger, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { NotchPayService } from './notchpay.service';

@Controller('payments')
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name);

  constructor(private readonly notchPayService: NotchPayService) {}

  @Post('initiate')
  @UseGuards(JwtAuthGuard)
  async initiate(
    @Body() body: { orderId: string; amount: number; phone: string; method: string },
  ) {
    return this.notchPayService.initiatePayment(
      body.amount,
      body.phone,
      body.orderId,
      body.method,
    );
  }

  @Get('verify/:reference')
  async verify(@Param('reference') reference: string) {
    return this.notchPayService.verifyPayment(reference);
  }

  @Post('webhook/notchpay')
  async webhook(@Body() body: any) {
    this.logger.log(`Webhook reçu: ${JSON.stringify(body)}`);
    return { received: true };
  }
}
