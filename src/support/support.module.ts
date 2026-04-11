import { Module } from '@nestjs/common';
import { SupportService } from './support.service';
import {
  AdminSupportController,
  SupportTicketsController,
} from './support.controller';

@Module({
  providers: [SupportService],
  controllers: [SupportTicketsController, AdminSupportController],
  exports: [SupportService],
})
export class SupportModule {}
