import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PartnersService } from './partners.service';
import { CreateApplicationDto } from './dto/create-application.dto';
import { QueryApplicationsDto } from './dto/query-applications.dto';
import {
  ApproveApplicationDto,
  RejectApplicationDto,
} from './dto/review-application.dto';

// ── User-facing routes ──────────────────────────────────────────────
@Controller('partner-applications')
@UseGuards(JwtAuthGuard)
export class PartnerApplicationsController {
  constructor(private readonly service: PartnersService) {}

  @Post()
  create(@CurrentUser() user: any, @Body() dto: CreateApplicationDto) {
    return this.service.create(user.id, dto);
  }

  @Get('mine')
  findMine(@CurrentUser() user: any) {
    return this.service.findMine(user.id);
  }
}

// ── Admin routes ────────────────────────────────────────────────────
@Controller('admin/partner-applications')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminPartnerApplicationsController {
  constructor(private readonly service: PartnersService) {}

  @Get('stats')
  stats() {
    return this.service.getStats();
  }

  @Get()
  findAll(@Query() query: QueryApplicationsDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post(':id/approve')
  approve(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() dto: ApproveApplicationDto,
  ) {
    return this.service.approve(id, user.id, dto);
  }

  @Post(':id/reject')
  reject(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() dto: RejectApplicationDto,
  ) {
    return this.service.reject(id, user.id, dto);
  }

  @Post(':id/under-review')
  underReview(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.markUnderReview(id, user.id);
  }

  @Post(':id/suspend')
  suspend(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() body: { reason?: string },
  ) {
    return this.service.suspend(id, user.id, body?.reason);
  }
}
