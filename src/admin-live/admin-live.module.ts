import { Module } from '@nestjs/common';
import { AdminLiveController } from './admin-live.controller';
import { AdminLiveService } from './admin-live.service';

@Module({
  controllers: [AdminLiveController],
  providers: [AdminLiveService],
})
export class AdminLiveModule {}
