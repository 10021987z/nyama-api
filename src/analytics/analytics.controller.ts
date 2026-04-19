import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AnalyticsService } from './analytics.service';
import { EventsGateway } from '../events/events.gateway';
import {
  QueryAdminUsersDto,
  QueryAdminOrdersDto,
  QueryAdminRestaurantsDto,
  QueryAdminDeliveriesDto,
  QueryAdminFleetDto,
  QueryAdminRevenueDto,
} from './dto/query-admin.dto';
import {
  CreateAdminUserDto,
  CreateAdminRestaurantDto,
  UpdateAdminRestaurantDto,
  CreateAdminFleetDto,
  UpdateAdminFleetDto,
} from './dto/admin-crud.dto';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AnalyticsController {
  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly eventsGateway: EventsGateway,
  ) {}

  // ── Debug socket.io : liste les connexions actives et leurs rooms ──
  @Get('socket/debug')
  getSocketDebug() {
    return this.eventsGateway.getDebugInfo();
  }

  @Get('dashboard')
  getDashboard() {
    return this.analyticsService.getDashboard();
  }

  @Get('users')
  getUsers(@Query() query: QueryAdminUsersDto) {
    return this.analyticsService.getUsers(query);
  }

  @Get('orders')
  getOrders(@Query() query: QueryAdminOrdersDto) {
    return this.analyticsService.getOrders(query);
  }

  @Get('restaurants')
  getRestaurants(@Query() query: QueryAdminRestaurantsDto) {
    return this.analyticsService.getRestaurants(query);
  }

  @Get('deliveries')
  getDeliveries(@Query() query: QueryAdminDeliveriesDto) {
    return this.analyticsService.getDeliveries(query);
  }

  @Get('fleet')
  getFleet(@Query() query: QueryAdminFleetDto) {
    return this.analyticsService.getFleet(query);
  }

  @Get('analytics/revenue')
  getRevenue(@Query() query: QueryAdminRevenueDto) {
    return this.analyticsService.getRevenue(query.period ?? '30d');
  }

  @Get('settings')
  getSettings() {
    return this.analyticsService.getSettings();
  }

  // ── CRUD mutations ──────────────────────────────────────────

  @Get('quarters')
  getQuarters() {
    return this.analyticsService.getQuarters();
  }

  @Post('users')
  createUser(@Body() dto: CreateAdminUserDto) {
    return this.analyticsService.createAdminUser(dto);
  }

  @Post('restaurants')
  createRestaurant(@Body() dto: CreateAdminRestaurantDto) {
    return this.analyticsService.createAdminRestaurant(dto);
  }

  @Patch('restaurants/:id')
  updateRestaurant(
    @Param('id') id: string,
    @Body() dto: UpdateAdminRestaurantDto,
  ) {
    return this.analyticsService.updateAdminRestaurant(id, dto);
  }

  @Post('fleet')
  createFleetRider(@Body() dto: CreateAdminFleetDto) {
    return this.analyticsService.createAdminFleetRider(dto);
  }

  @Patch('fleet/:id')
  updateFleetRider(
    @Param('id') id: string,
    @Body() dto: UpdateAdminFleetDto,
  ) {
    return this.analyticsService.updateAdminFleetRider(id, dto);
  }
}
