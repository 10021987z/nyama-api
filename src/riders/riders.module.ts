import { Module } from '@nestjs/common';
import { RidersService } from './riders.service';
import { RidersController } from './riders.controller';
import { RiderController } from './rider.controller';

@Module({
  providers: [RidersService],
  controllers: [RidersController, RiderController],
})
export class RidersModule {}
