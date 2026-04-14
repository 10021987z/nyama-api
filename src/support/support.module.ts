import { Module } from '@nestjs/common';
import { SupportService } from './support.service';
import {
  AdminSupportController,
  PublicSupportController,
  SupportTicketsController,
} from './support.controller';

@Module({
  providers: [SupportService],
  controllers: [
    SupportTicketsController,
    PublicSupportController,
    AdminSupportController,
  ],
  exports: [SupportService],
})
export class SupportModule {}
