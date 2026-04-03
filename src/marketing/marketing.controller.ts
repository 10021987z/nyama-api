import { Controller, Get, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { MarketingService } from './marketing.service';

@Controller('admin/marketing')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class MarketingController {
  constructor(private readonly marketingService: MarketingService) {}

  @Get('overview')
  getOverview() {
    return this.marketingService.getOverview();
  }
}
