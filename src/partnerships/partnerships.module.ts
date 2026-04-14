import { Module } from '@nestjs/common';
import { PartnershipsService } from './partnerships.service';
import {
  PublicPartnershipsController,
  AdminPartnershipsController,
} from './partnerships.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [PublicPartnershipsController, AdminPartnershipsController],
  providers: [PartnershipsService],
  exports: [PartnershipsService],
})
export class PartnershipsModule {}
