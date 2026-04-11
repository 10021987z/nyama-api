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
import { DisputesService } from './disputes.service';
import { CreateDisputeDto } from './dto/create-dispute.dto';
import { QueryDisputesDto } from './dto/query-disputes.dto';
import {
  AddDisputeMessageDto,
  UpdateDisputeDto,
} from './dto/update-dispute.dto';

// ── User-facing routes (any authenticated user) ─────────────────────
@Controller('disputes')
@UseGuards(JwtAuthGuard)
export class DisputesController {
  constructor(private readonly service: DisputesService) {}

  @Post()
  create(@CurrentUser() user: any, @Body() dto: CreateDisputeDto) {
    return this.service.create(user, dto);
  }

  @Get('mine')
  findMine(@CurrentUser() user: any) {
    return this.service.findMine(user.id);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.findOne(id, user);
  }

  @Post(':id/messages')
  addMessage(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() dto: AddDisputeMessageDto,
  ) {
    return this.service.addMessage(id, user, dto);
  }
}

// ── Admin routes ────────────────────────────────────────────────────
@Controller('admin/disputes')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminDisputesController {
  constructor(private readonly service: DisputesService) {}

  @Get('stats')
  stats() {
    return this.service.getStats();
  }

  @Get()
  findAll(@Query() query: QueryDisputesDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.findOne(id, user);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateDisputeDto,
    @CurrentUser() user: any,
  ) {
    return this.service.update(id, dto, user.id);
  }

  @Post(':id/messages')
  addMessage(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() dto: AddDisputeMessageDto,
  ) {
    return this.service.addMessage(id, user, dto);
  }
}
