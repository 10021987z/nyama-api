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
import { SupportService } from './support.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { QueryTicketsDto } from './dto/query-tickets.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';

// ── User-facing routes (client / cook / rider apps) ────────────────
@Controller('support/tickets')
@UseGuards(JwtAuthGuard)
export class SupportTicketsController {
  constructor(private readonly service: SupportService) {}

  @Post()
  create(@CurrentUser() user: any, @Body() dto: CreateTicketDto) {
    return this.service.create(user, dto);
  }

  @Get('mine')
  findMine(@CurrentUser() user: any) {
    return this.service.findMine(user.id);
  }
}

// ── Admin dashboard routes ─────────────────────────────────────────
@Controller('admin/support')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminSupportController {
  constructor(private readonly service: SupportService) {}

  @Get('overview')
  getOverview() {
    return this.service.getOverview();
  }

  @Get('tickets')
  findAll(@Query() query: QueryTicketsDto) {
    return this.service.findAll(query);
  }

  @Get('tickets/:id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch('tickets/:id')
  update(@Param('id') id: string, @Body() dto: UpdateTicketDto) {
    return this.service.update(id, dto);
  }
}
