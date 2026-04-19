import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RidersService } from './riders.service';
import { UpdateDeliveryStatusDto } from './dto/update-delivery-status.dto';
import { QueryEarningsDto } from './dto/query-earnings.dto';
import { SendOrderMessageDto } from './dto/send-order-message.dto';
import { UpdateRiderStatusDto } from './dto/update-rider-status.dto';

interface AuthUser {
  id: string;
  role: UserRole;
}

@Controller('rider')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.RIDER)
export class RiderController {
  constructor(private readonly ridersService: RidersService) {}

  @Get('profile')
  getProfile(@CurrentUser() user: AuthUser) {
    return this.ridersService.getProfile(user.id);
  }

  @Get('available-orders')
  getAvailableOrders() {
    return this.ridersService.getAvailableOrders();
  }

  @Post('orders/:id/accept')
  @HttpCode(HttpStatus.OK)
  acceptOrder(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.ridersService.acceptOrder(id, user.id);
  }

  // Certains clients utilisent PATCH historiquement → on supporte les deux.
  @Patch('orders/:id/accept')
  @HttpCode(HttpStatus.OK)
  acceptOrderPatch(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.ridersService.acceptOrder(id, user.id);
  }

  @Post('status')
  @HttpCode(HttpStatus.OK)
  updateStatus(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateRiderStatusDto,
  ) {
    return this.ridersService.updateRiderStatus(user.id, dto);
  }

  @Patch('deliveries/:id/status')
  @HttpCode(HttpStatus.OK)
  updateDeliveryStatus(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateDeliveryStatusDto,
  ) {
    return this.ridersService.updateDeliveryStatus(id, user.id, dto.status);
  }

  @Get('earnings')
  getEarnings(@CurrentUser() user: AuthUser, @Query() query: QueryEarningsDto) {
    return this.ridersService.getEarnings(user.id, query);
  }

  // ─── Chat livreur ↔ cuisinière ──────────────────────────

  @Get('orders/:orderId/messages')
  listOrderMessages(
    @Param('orderId') orderId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.ridersService.listOrderMessagesAsRider(orderId, user.id);
  }

  @Post('orders/:orderId/messages')
  @HttpCode(HttpStatus.CREATED)
  postOrderMessage(
    @Param('orderId') orderId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: SendOrderMessageDto,
  ) {
    return this.ridersService.postOrderMessageAsRider(orderId, user.id, dto);
  }
}
