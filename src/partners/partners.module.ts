import { Module } from '@nestjs/common';
import { PartnersService } from './partners.service';
import {
  AdminPartnerApplicationsController,
  PartnerApplicationsController,
} from './partners.controller';

@Module({
  controllers: [
    PartnerApplicationsController,
    AdminPartnerApplicationsController,
  ],
  providers: [PartnersService],
  exports: [PartnersService],
})
export class PartnersModule {}
