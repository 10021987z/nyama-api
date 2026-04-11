import { Module } from '@nestjs/common';
import { DisputesService } from './disputes.service';
import {
  AdminDisputesController,
  DisputesController,
} from './disputes.controller';

@Module({
  controllers: [DisputesController, AdminDisputesController],
  providers: [DisputesService],
  exports: [DisputesService],
})
export class DisputesModule {}
