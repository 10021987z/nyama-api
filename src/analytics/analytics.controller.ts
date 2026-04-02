import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AnalyticsService } from './analytics.service';
import { QueryAdminUsersDto, QueryAdminOrdersDto } from './dto/query-admin.dto';

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
}
