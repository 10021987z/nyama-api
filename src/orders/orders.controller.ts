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
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { QueryOrdersDto } from './dto/query-orders.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { SubmitRatingDto } from './dto/submit-rating.dto';
import { SendOrderMessageDto } from '../cooks/dto/send-order-message.dto';

interface AuthUser {
  id: string;
  role: UserRole;
}

@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateOrderDto) {
    return this.ordersService.create(user.id, dto);
  }

  @Get()
  findAll(@CurrentUser() user: AuthUser, @Query() query: QueryOrdersDto) {
    return this.ordersService.findAll(user.id, user.role, query);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.ordersService.findOne(id, user.id, user.role);
  }

  @Patch(':id/cancel')
  @HttpCode(HttpStatus.OK)
  cancel(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() body: { reason?: string; cancelReason?: string },
  ) {
    const reason = body?.reason ?? body?.cancelReason;
    if (user.role === UserRole.ADMIN) {
      return this.ordersService.adminUpdateStatus(id, 'CANCELLED' as never, reason);
    }
    return this.ordersService.clientCancel(id, user.id, reason);
  }

  @Patch(':id/accept')
  @UseGuards(RolesGuard)
  @Roles(UserRole.COOK)
  @HttpCode(HttpStatus.OK)
  accept(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.ordersService.cookAccept(id, user.id);
  }

  @Patch(':id/ready')
  @UseGuards(RolesGuard)
  @Roles(UserRole.COOK)
  @HttpCode(HttpStatus.OK)
  ready(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.ordersService.cookReady(id, user.id);
  }

  @Patch(':id/assign')
  @UseGuards(RolesGuard)
  @Roles(UserRole.RIDER, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  assign(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() body: { riderId?: string },
  ) {
    const riderId = body?.riderId ?? user.id;
    return this.ordersService.assignRider(id, riderId, user.role, user.id);
  }

  @Patch(':id/pickup')
  @UseGuards(RolesGuard)
  @Roles(UserRole.RIDER)
  @HttpCode(HttpStatus.OK)
  pickup(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.ordersService.riderPickup(id, user.id);
  }

  @Patch(':id/deliver')
  @UseGuards(RolesGuard)
  @Roles(UserRole.RIDER)
  @HttpCode(HttpStatus.OK)
  deliver(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.ordersService.riderDeliver(id, user.id);
  }

  /**
   * POST /orders/:id/rating — notation post-livraison par le client.
   * Body : { riderStars, restaurantStars, appStars, comment?, tags? }
   * Retourne : { ok: true, rating: {...} } (ou 409 ALREADY_RATED).
   */
  @Post(':id/rating')
  @UseGuards(RolesGuard)
  @Roles(UserRole.CLIENT)
  @HttpCode(HttpStatus.CREATED)
  submitRating(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: SubmitRatingDto,
  ) {
    return this.ordersService.submitRating(id, user.id, dto);
  }

  /**
   * Chat sur une commande — accessible aux 3 rôles (client, cook, rider).
   * GET récupère l'historique chronologique. POST persiste + émet socket
   * `message:new` sur la room `order-{orderId}` (les 3 participants y sont).
   */
  @Get(':id/messages')
  listMessages(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.ordersService.listOrderMessages(id, user.id, user.role);
  }

  @Post(':id/messages')
  @HttpCode(HttpStatus.CREATED)
  postMessage(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: SendOrderMessageDto,
  ) {
    return this.ordersService.postOrderMessage(id, user.id, user.role, dto);
  }
}

@Controller('admin/orders')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminOrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  findAll(@CurrentUser() user: AuthUser, @Query() query: QueryOrdersDto) {
    return this.ordersService.findAll(user.id, UserRole.ADMIN, query);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.ordersService.findOne(id, user.id, UserRole.ADMIN);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateOrderStatusDto) {
    return this.ordersService.adminUpdateStatus(id, dto.status, dto.cancelReason);
  }
}
