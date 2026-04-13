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
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PartnershipsService } from './partnerships.service';
import { CreatePartnershipDto } from './dto/create-partnership.dto';
import { UpdatePartnershipDto } from './dto/update-partnership.dto';
import { QueryPartnershipsDto } from './dto/query-partnerships.dto';

// ── Public route — no auth required ────────────────────────────────
@Controller('partnerships')
export class PublicPartnershipsController {
  constructor(private readonly service: PartnershipsService) {}

  @Post()
  create(@Body() dto: CreatePartnershipDto) {
    return this.service.create(dto);
  }
}

// ── Admin routes ───────────────────────────────────────────────────
@Controller('admin/partnerships')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminPartnershipsController {
  constructor(private readonly service: PartnershipsService) {}

  @Get('stats')
  stats() {
    return this.service.getStats();
  }

  @Get()
  findAll(@Query() query: QueryPartnershipsDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdatePartnershipDto,
    @CurrentUser() user: any,
  ) {
    return this.service.update(id, dto, user.id);
  }
}
