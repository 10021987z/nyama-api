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
import { OnboardingService } from './onboarding.service';
import {
  ApplyRiderDto,
  QueryApplicationsDto,
  UpdateApplicationStatusDto,
} from './dto/apply.dto';

// ── Public routes ─────────────────────────────────────────────────
@Controller('onboarding/rider')
export class OnboardingController {
  constructor(private readonly service: OnboardingService) {}

  @Post('apply')
  apply(@Body() dto: ApplyRiderDto) {
    return this.service.apply(dto);
  }

  @Get(':id/status')
  getStatus(@Param('id') id: string) {
    return this.service.getStatus(id);
  }
}

// ── Admin routes ──────────────────────────────────────────────────
@Controller('admin/onboarding')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminOnboardingController {
  constructor(private readonly service: OnboardingService) {}

  @Get('stats')
  stats() {
    return this.service.getStats();
  }

  @Get('applications')
  findAll(@Query() query: QueryApplicationsDto) {
    return this.service.findAll(query);
  }

  @Get('applications/:id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch('applications/:id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateApplicationStatusDto,
  ) {
    return this.service.updateStatus(id, dto);
  }
}
