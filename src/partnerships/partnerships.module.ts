import { Module } from '@nestjs/common';
import { PartnershipsService } from './partnerships.service';
import {
  PublicPartnershipsController,
  AdminPartnershipsController,
} from './partnerships.controller';

@Module({
  controllers: [PublicPartnershipsController, AdminPartnershipsController],
  providers: [PartnershipsService],
  exports: [PartnershipsService],
})
export class PartnershipsModule {}
