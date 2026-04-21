import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  Sse,
  UseGuards,
  MessageEvent,
} from '@nestjs/common';
import { Response } from 'express';
import { UserRole } from '@prisma/client';
import { map, Observable } from 'rxjs';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AdminLiveService } from './admin-live.service';
import { EventsService } from '../events/events.service';
import {
  InterveneOrderDto,
  PatchAdminUserDto,
  QueryAdminUsersLiveDto,
  QueryCustomReportDto,
} from './dto/admin-live.dto';
import * as ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';

interface AuthUser {
  id: string;
  role: UserRole;
}

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminLiveController {
  constructor(
    private readonly live: AdminLiveService,
    private readonly events: EventsService,
  ) {}

  // 1) /admin/live/overview
  @Get('live/overview')
  getOverview() {
    return this.live.getOverview();
  }

  // 2) /admin/live/map
  @Get('live/map')
  getLiveMap() {
    return this.live.getLiveMap();
  }

  // 3) /admin/live/orders-stream (SSE)
  //
  // Pipes the adminBus (every socket event mirrored to room `admin`)
  // into an EventSource stream for dashboards that can't open a socket.io
  // connection (e.g. server components, cURL).
  @Sse('live/orders-stream')
  ordersStream(): Observable<MessageEvent> {
    return this.events.adminStream$.pipe(
      map(
        (e) =>
          ({
            type: e.event,
            data: JSON.stringify({ event: e.event, data: e.data, at: e.at }),
          }) satisfies MessageEvent,
      ),
    );
  }

  // 5) /admin/users/live
  @Get('users/live')
  getUsersLive(@Query() query: QueryAdminUsersLiveDto) {
    return this.live.getUsersLive(query);
  }

  // 6) PATCH /admin/users/:id
  @Patch('users/:id')
  patchUser(
    @Param('id') id: string,
    @Body() dto: PatchAdminUserDto,
    @CurrentUser() admin: AuthUser,
  ) {
    return this.live.patchUser(id, dto, admin.id);
  }

  // 7) POST /admin/orders/:id/intervene
  @Post('orders/:id/intervene')
  intervene(
    @Param('id') id: string,
    @Body() dto: InterveneOrderDto,
    @CurrentUser() admin: AuthUser,
  ) {
    return this.live.interveneOnOrder(id, dto, admin.id);
  }

  // 8) GET /admin/reports/custom
  @Get('reports/custom')
  async customReport(
    @Query() query: QueryCustomReportDto,
    @Res() res: Response,
  ) {
    const report = await this.live.buildCustomReport(query);
    const filenameBase = `nyama-report-${query.from}_${query.to}`;

    if (query.format === 'csv') {
      const header =
        'id,status,client,clientPhone,cook,rider,totalXaf,deliveryFeeXaf,paymentMethod,paymentStatus,createdAt,deliveredAt,cancelledAt';
      const csv =
        header +
        '\n' +
        report.rows
          .map((r) =>
            [
              r.id,
              r.status,
              esc(r.client),
              esc(r.clientPhone),
              esc(r.cook),
              esc(r.rider),
              r.totalXaf,
              r.deliveryFeeXaf,
              r.paymentMethod,
              r.paymentStatus,
              r.createdAt,
              r.deliveredAt,
              r.cancelledAt,
            ].join(','),
          )
          .join('\n');
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${filenameBase}.csv"`,
      );
      res.send(csv);
      return;
    }

    if (query.format === 'excel') {
      const wb = new ExcelJS.Workbook();
      const sheet = wb.addWorksheet('Orders');
      sheet.columns = [
        { header: 'ID', key: 'id', width: 36 },
        { header: 'Status', key: 'status', width: 12 },
        { header: 'Client', key: 'client', width: 20 },
        { header: 'Phone', key: 'clientPhone', width: 16 },
        { header: 'Cook', key: 'cook', width: 20 },
        { header: 'Rider', key: 'rider', width: 20 },
        { header: 'Total (XAF)', key: 'totalXaf', width: 12 },
        { header: 'Delivery fee', key: 'deliveryFeeXaf', width: 12 },
        { header: 'Payment method', key: 'paymentMethod', width: 14 },
        { header: 'Payment status', key: 'paymentStatus', width: 14 },
        { header: 'Created', key: 'createdAt', width: 24 },
        { header: 'Delivered', key: 'deliveredAt', width: 24 },
        { header: 'Cancelled', key: 'cancelledAt', width: 24 },
      ];
      sheet.getRow(1).font = { bold: true };
      for (const r of report.rows) sheet.addRow(r);
      const summary = wb.addWorksheet('Summary');
      summary.addRow(['Total orders', report.summary.totalOrders]);
      summary.addRow(['Total revenue (XAF)', report.summary.totalRevenueXaf]);
      summary.addRow(['From', report.summary.from]);
      summary.addRow(['To', report.summary.to]);

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${filenameBase}.xlsx"`,
      );
      const buffer = await wb.xlsx.writeBuffer();
      res.send(Buffer.from(buffer));
      return;
    }

    // pdf
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${filenameBase}.pdf"`,
    );
    doc.pipe(res);
    doc.fontSize(18).text('NYAMA — Rapport de commandes', { align: 'center' });
    doc.moveDown();
    doc
      .fontSize(10)
      .text(`Période : ${report.summary.from} → ${report.summary.to}`)
      .text(`Total commandes : ${report.summary.totalOrders}`)
      .text(`Revenu total : ${report.summary.totalRevenueXaf} XAF`);
    doc.moveDown();

    const headers = [
      'Date',
      'Status',
      'Client',
      'Cuisinière',
      'Livreur',
      'Total XAF',
    ];
    doc.fontSize(9).text(headers.join(' | '), { underline: true });
    doc.moveDown(0.2);
    for (const r of report.rows.slice(0, 500)) {
      doc
        .fontSize(8)
        .text(
          [
            r.createdAt.slice(0, 16),
            r.status,
            r.client,
            r.cook,
            r.rider,
            String(r.totalXaf),
          ].join(' | '),
        );
    }
    if (report.rows.length > 500) {
      doc.moveDown().fontSize(8).text(`… ${report.rows.length - 500} lignes supplémentaires non affichées dans le PDF.`);
    }
    doc.end();
  }
}

function esc(v: string | null | undefined): string {
  if (v == null) return '';
  if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}
