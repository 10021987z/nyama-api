import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, TicketPriority, TicketStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { QueryTicketsDto } from './dto/query-tickets.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';

type Principal = {
  id: string;
  role?: string;
  adminRole?: string;
} | null;

@Injectable()
export class SupportService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Create ticket (any authenticated user or guest) ───────────────
  async create(user: Principal, dto: CreateTicketDto) {
    const reporterRole =
      dto.reporterRole ?? (user?.role ? String(user.role) : 'GUEST');

    return this.prisma.supportTicket.create({
      data: {
        userId: user?.id ?? null,
        reporterRole,
        category: dto.category,
        priority: dto.priority ?? TicketPriority.NORMAL,
        subject: dto.subject,
        message: dto.message,
        contactPhone: dto.contactPhone,
        contactEmail: dto.contactEmail,
        orderId: dto.orderId,
        attachments: dto.attachments,
      },
    });
  }

  async findMine(userId: string) {
    return this.prisma.supportTicket.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ── Admin list + stats ────────────────────────────────────────────
  async findAll(query: QueryTicketsDto) {
    const { status, priority, category, search } = query;
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const where: Prisma.SupportTicketWhereInput = {
      ...(status && { status }),
      ...(priority && { priority }),
      ...(category && { category }),
      ...(search && {
        OR: [
          { subject: { contains: search, mode: 'insensitive' } },
          { message: { contains: search, mode: 'insensitive' } },
          { contactPhone: { contains: search } },
        ],
      }),
    };

    const [items, total] = await Promise.all([
      this.prisma.supportTicket.findMany({
        where,
        orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
        include: {
          user: { select: { id: true, name: true, phone: true, role: true } },
        },
      }),
      this.prisma.supportTicket.count({ where }),
    ]);
    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string) {
    const t = await this.prisma.supportTicket.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, phone: true, email: true } },
      },
    });
    if (!t) throw new NotFoundException('Ticket introuvable');
    return t;
  }

  async update(id: string, dto: UpdateTicketDto) {
    const existing = await this.prisma.supportTicket.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException('Ticket introuvable');

    const data: Prisma.SupportTicketUpdateInput = { ...dto };
    if (dto.status === TicketStatus.RESOLVED) data.resolvedAt = new Date();

    return this.prisma.supportTicket.update({ where: { id }, data });
  }

  // ── Admin overview (used by dashboard) ────────────────────────────
  async getOverview() {
    const [open, inProgress, resolved, urgentCount, avgResolution, critical] =
      await Promise.all([
        this.prisma.supportTicket.count({
          where: { status: TicketStatus.OPEN },
        }),
        this.prisma.supportTicket.count({
          where: { status: TicketStatus.IN_PROGRESS },
        }),
        this.prisma.supportTicket.count({
          where: { status: TicketStatus.RESOLVED },
        }),
        this.prisma.supportTicket.count({
          where: { priority: TicketPriority.URGENT },
        }),
        this.prisma.supportTicket.findMany({
          where: { resolvedAt: { not: null } },
          select: { createdAt: true, resolvedAt: true },
          take: 200,
          orderBy: { resolvedAt: 'desc' },
        }),
        this.prisma.review.findMany({
          where: { cookRating: { lte: 2 } },
          include: {
            order: {
              select: {
                id: true,
                totalXaf: true,
                cook: {
                  select: {
                    name: true,
                    cookProfile: { select: { displayName: true } },
                  },
                },
              },
            },
            author: { select: { name: true, phone: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 5,
        }),
      ]);

    const avgResolutionHours =
      avgResolution.length === 0
        ? 0
        : avgResolution.reduce(
            (acc, t) =>
              acc +
              (t.resolvedAt!.getTime() - t.createdAt.getTime()) / 3_600_000,
            0,
          ) / avgResolution.length;

    const recentTickets = await this.prisma.supportTicket.findMany({
      where: { status: { in: [TicketStatus.OPEN, TicketStatus.IN_PROGRESS] } },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
      take: 10,
      include: {
        user: { select: { name: true, phone: true } },
      },
    });

    return {
      stats: {
        openTickets: open + inProgress,
        resolvedTickets: resolved,
        urgentTickets: urgentCount,
        avgResolutionHours: Number(avgResolutionHours.toFixed(2)),
      },
      tickets: recentTickets,
      criticalReviews: critical,
    };
  }
}
