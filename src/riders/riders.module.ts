import { Module } from '@nestjs/common';
import { RidersService } from './riders.service';
import { RidersController } from './riders.controller';
import { RiderController } from './rider.controller';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [UsersModule],
  providers: [RidersService],
  controllers: [RidersController, RiderController],
})
export class RidersModule {}
