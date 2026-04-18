import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { OrderStatus, UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CooksService } from './cooks.service';
import { QueryCookOrdersDto } from './dto/query-cook-orders.dto';
import { RejectOrderDto } from './dto/reject-order.dto';
import { CreateMenuItemDto } from './dto/create-menu-item.dto';
import { UpdateMenuItemDto } from './dto/update-menu-item.dto';
import { SetAvailabilityDto } from './dto/set-availability.dto';
import { SetRushDto } from './dto/set-rush.dto';
import { SendOrderMessageDto } from './dto/send-order-message.dto';

interface AuthUser {
  id: string;
  role: UserRole;
  phone: string;
}

@Controller('cook')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.COOK)
export class CookController {
  constructor(private readonly cooksService: CooksService) {}

  // ─── Dashboard & Commandes ───────────────────────────────

  @Get('dashboard')
  getDashboard(@CurrentUser() user: AuthUser) {
    return this.cooksService.getDashboard(user.id);
  }

  @Get('orders')
  getCookOrders(
    @CurrentUser() user: AuthUser,
    @Query() query: QueryCookOrdersDto,
  ) {
    return this.cooksService.getCookOrders(user.id, query);
  }

  @Patch('orders/:id/accept')
  @HttpCode(HttpStatus.OK)
  acceptOrder(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.cooksService.acceptOrder(id, user.id);
  }

  @Patch('orders/:id/preparing')
  @HttpCode(HttpStatus.OK)
  startPreparing(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.cooksService.transitionOrder(id, user.id, OrderStatus.PREPARING);
  }

  @Patch('orders/:id/ready')
  @HttpCode(HttpStatus.OK)
  markReady(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.cooksService.transitionOrder(id, user.id, OrderStatus.READY);
  }

  @Patch('orders/:id/reject')
  @HttpCode(HttpStatus.OK)
  rejectOrder(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: RejectOrderDto,
  ) {
    return this.cooksService.rejectOrder(id, user.id, dto.reason);
  }

  // ─── Gestion du menu ────────────────────────────────────

  @Get('menu')
  getMenu(@CurrentUser() user: AuthUser) {
    return this.cooksService.getCookMenu(user.id);
  }

  @Post('menu/items')
  createMenuItem(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateMenuItemDto,
  ) {
    return this.cooksService.createMenuItem(user.id, dto);
  }

  @Patch('menu/items/:id')
  updateMenuItem(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateMenuItemDto,
  ) {
    return this.cooksService.updateMenuItem(id, user.id, dto);
  }

  @Delete('menu/items/:id')
  @HttpCode(HttpStatus.OK)
  deleteMenuItem(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.cooksService.softDeleteMenuItem(id, user.id);
  }

  @Patch('menu-items/:id/availability')
  @HttpCode(HttpStatus.OK)
  setMenuItemAvailability(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: SetAvailabilityDto,
  ) {
    return this.cooksService.setMenuItemAvailability(id, user.id, dto);
  }

  // ─── Stats & Rush ────────────────────────────────────────

  @Get('stats/today')
  getStatsToday(@CurrentUser() user: AuthUser) {
    return this.cooksService.getStatsToday(user.id);
  }

  @Get('stats/weekly')
  getStatsWeekly(@CurrentUser() user: AuthUser) {
    return this.cooksService.getStatsWeekly(user.id);
  }

  @Get('orders/prep-time-estimate')
  getPrepTimeEstimate(@CurrentUser() user: AuthUser) {
    return this.cooksService.getPrepTimeEstimate(user.id);
  }

  @Patch('status/rush')
  @HttpCode(HttpStatus.OK)
  setRushStatus(
    @CurrentUser() user: AuthUser,
    @Body() dto: SetRushDto,
  ) {
    return this.cooksService.setRushStatus(user.id, dto);
  }

  // ─── Chat cuisinière ↔ livreur ──────────────────────────

  @Get('orders/:orderId/messages')
  listOrderMessages(
    @Param('orderId') orderId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.cooksService.listOrderMessagesAsCook(orderId, user.id);
  }

  @Post('orders/:orderId/messages')
  @HttpCode(HttpStatus.CREATED)
  postOrderMessage(
    @Param('orderId') orderId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: SendOrderMessageDto,
  ) {
    return this.cooksService.postOrderMessageAsCook(orderId, user.id, dto);
  }
}
