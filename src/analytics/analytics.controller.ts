import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AnalyticsService } from './analytics.service';
import {
  QueryAdminUsersDto,
  QueryAdminOrdersDto,
  QueryAdminRestaurantsDto,
  QueryAdminDeliveriesDto,
  QueryAdminFleetDto,
  QueryAdminRevenueDto,
} from './dto/query-admin.dto';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

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
}
