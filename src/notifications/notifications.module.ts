import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { EmailService } from './email.service';

@Module({
  providers: [NotificationsService, EmailService],
  exports: [EmailService],
})
export class NotificationsModule {}
