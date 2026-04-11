import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { AdminOrdersController, OrdersController } from './orders.controller';

@Module({
  providers: [OrdersService],
  controllers: [OrdersController, AdminOrdersController],
})
export class OrdersModule {}
