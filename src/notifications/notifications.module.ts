import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { EmailService } from './email.service';
import { WhatsappService } from './whatsapp.service';

@Module({
  providers: [NotificationsService, EmailService, WhatsappService],
  exports: [EmailService, WhatsappService],
})
export class NotificationsModule {}
