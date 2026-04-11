import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { NotchPayService } from './notchpay.service';

@Module({
  imports: [ConfigModule],
  providers: [PaymentsService, NotchPayService],
  controllers: [PaymentsController],
  exports: [NotchPayService, PaymentsService],
})
export class PaymentsModule {}
