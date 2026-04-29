import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
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
import { AdminExtrasService } from './admin-extras.service';
import { BroadcastCookDto } from './dto/broadcast-cook.dto';
import { BroadcastRidersDto } from './dto/broadcast-riders.dto';
import { SendAdminMessageDto } from './dto/send-admin-message.dto';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { DailyReportDto } from './dto/daily-report.dto';

interface AuthUser {
  id: string;
  role: UserRole;
}

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminExtrasController {
  constructor(private readonly extras: AdminExtrasService) {}

  // 1) Commissions par cook
  @Get('finances/commissions')
  getCommissions(@Query('period') period?: string) {
    const p = period === '7d' ? '7d' : '30d';
    return this.extras.getCommissions(p);
  }

  // 2) Trésorerie
  @Get('finances/treasury')
  getTreasury() {
    return this.extras.getTreasury();
  }

  // 3) Fiche paie rider
  @Get('finances/payslip/:riderId')
  getPayslip(
    @Param('riderId') riderId: string,
    @Query('week') week?: string,
  ) {
    return this.extras.getRiderPayslip(riderId, week);
  }
  // Alias plus explicite
  @Get('finances/rider-payslips/:riderId')
  getRiderPayslip(
    @Param('riderId') riderId: string,
    @Query('week') week?: string,
  ) {
    return this.extras.getRiderPayslip(riderId, week);
  }

  // 4) Heatmap commandes
  @Get('analytics/heatmap')
  getHeatmap(@Query('period') period?: string) {
    const p = period === '7d' ? '7d' : '24h';
    return this.extras.getHeatmap(p);
  }

  // 5) Historique CA jour par jour
  @Get('analytics/revenue-history')
  getRevenueHistory(@Query('days') days?: string) {
    const d = Math.min(60, Math.max(1, parseInt(days ?? '14', 10) || 14));
    return this.extras.getRevenueHistory(d);
  }

  // 6) Charge des cooks
  @Get('analytics/cooks-load')
  getCooksLoad() {
    return this.extras.getCooksLoad();
  }

  // 7) Leaderboard riders
  @Get('leaderboard/riders')
  getRidersLeaderboard(@Query('period') period?: string) {
    const p = period === 'month' ? 'month' : 'week';
    return this.extras.getRidersLeaderboard(p);
  }

  // 8) Leaderboard cooks
  @Get('leaderboard/cooks')
  getCooksLeaderboard(@Query('period') period?: string) {
    const p = period === 'month' ? 'month' : 'week';
    return this.extras.getCooksLeaderboard(p);
  }

  // 9) Mode crise
  @Get('crisis/status')
  getCrisisStatus() {
    return this.extras.getCrisisStatus();
  }

  @Post('crisis/activate')
  @HttpCode(HttpStatus.OK)
  activateCrisis(
    @Body() body: { minutes: number; reason: string },
    @CurrentUser() admin: AuthUser,
  ) {
    return this.extras.activateCrisis({
      minutes: Number(body?.minutes) || 0,
      reason: body?.reason ?? '',
      adminId: admin.id,
    });
  }

  @Post('crisis/deactivate')
  @HttpCode(HttpStatus.OK)
  deactivateCrisis() {
    return this.extras.deactivateCrisis();
  }

  // 10) Prédiction CA demain
  @Get('ai/predict-tomorrow')
  predictTomorrow() {
    return this.extras.predictTomorrow();
  }

  // ─── Broadcasts & messagerie admin ───────────────────────────────
  // Émission éphémère via WebSocket. Voir admin-extras.service.ts pour le
  // détail des rooms ciblées.

  @Post('broadcast/cook/:id')
  @HttpCode(HttpStatus.OK)
  broadcastToCook(
    @Param('id') cookId: string,
    @Body() dto: BroadcastCookDto,
    @CurrentUser() admin: AuthUser,
  ) {
    return this.extras.broadcastToCook(cookId, dto.message, admin.id);
  }

  @Post('broadcast/riders')
  @HttpCode(HttpStatus.OK)
  broadcastToRiders(
    @Body() dto: BroadcastRidersDto,
    @CurrentUser() admin: AuthUser,
  ) {
    return this.extras.broadcastToRiders(dto.message, admin.id, dto.quarterId);
  }

  @Post('messages')
  @HttpCode(HttpStatus.OK)
  sendDirectMessage(
    @Body() dto: SendAdminMessageDto,
    @CurrentUser() admin: AuthUser,
  ) {
    return this.extras.sendDirectMessage(dto, admin.id);
  }

  @Post('campaigns')
  @HttpCode(HttpStatus.OK)
  createCampaign(
    @Body() dto: CreateCampaignDto,
    @CurrentUser() admin: AuthUser,
  ) {
    return this.extras.createCampaign(dto, admin.id);
  }

  @Post('reports/daily')
  @HttpCode(HttpStatus.OK)
  generateDailyReport(@Body() dto: DailyReportDto) {
    return this.extras.generateDailyReport(dto.date, dto.to);
  }
}
