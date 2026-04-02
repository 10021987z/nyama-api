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
}
