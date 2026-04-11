import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  DisputeStatus,
  Prisma,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDisputeDto } from './dto/create-dispute.dto';
import { QueryDisputesDto } from './dto/query-disputes.dto';
import {
  AddDisputeMessageDto,
  UpdateDisputeDto,
} from './dto/update-dispute.dto';

type Principal = {
  id: string;
  role?: string;
  adminRole?: string;
  isAdmin?: boolean;
};

const isAdminPrincipal = (u: Principal) =>
  Boolean(u.adminRole) || u.role === UserRole.ADMIN;

@Injectable()
export class DisputesService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Admin list + stats ────────────────────────────────────────────
  async findAll(query: QueryDisputesDto) {
    const { status, severity, type, assignedTo, search } = query;
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const where: Prisma.DisputeWhereInput = {
      ...(status && { status }),
      ...(severity && { severity }),
      ...(type && { type }),
      ...(assignedTo && { assignedTo }),
      ...(search && {
        OR: [
          { description: { contains: search, mode: 'insensitive' } },
          { orderId: { contains: search, mode: 'insensitive' } },
          { client: { name: { contains: search, mode: 'insensitive' } } },
        ],
      }),
    };

    const [items, total] = await Promise.all([
      this.prisma.dispute.findMany({
        where,
        orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
        include: {
          client: { select: { id: true, name: true, phone: true } },
          order: {
            select: {
              id: true,
              totalXaf: true,
              status: true,
              paymentMethod: true,
              cook: { select: { id: true, name: true } },
            },
          },
          _count: { select: { messages: true } },
        },
      }),
      this.prisma.dispute.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getStats() {
    const [
      openCount,
      underReviewCount,
      resolvedCount,
      escalatedCount,
      criticalCount,
      totalRefunds,
    ] = await Promise.all([
      this.prisma.dispute.count({ where: { status: DisputeStatus.OPEN } }),
      this.prisma.dispute.count({
        where: { status: DisputeStatus.UNDER_REVIEW },
      }),
      this.prisma.dispute.count({ where: { status: DisputeStatus.RESOLVED } }),
      this.prisma.dispute.count({
        where: { status: DisputeStatus.ESCALATED },
      }),
      this.prisma.dispute.count({ where: { severity: 'CRITICAL' } }),
      this.prisma.dispute.aggregate({
        _sum: { refundAmountXaf: true },
        where: { status: DisputeStatus.RESOLVED },
      }),
    ]);

    // Mean resolution time in hours
    const resolved = await this.prisma.dispute.findMany({
      where: { resolvedAt: { not: null } },
      select: { createdAt: true, resolvedAt: true },
      take: 200,
      orderBy: { resolvedAt: 'desc' },
    });
    const avgResolutionHours =
      resolved.length === 0
        ? 0
        : resolved.reduce((acc, d) => {
            const ms =
              (d.resolvedAt!.getTime() - d.createdAt.getTime()) / 3_600_000;
            return acc + ms;
          }, 0) / resolved.length;

    return {
      open: openCount,
      underReview: underReviewCount,
      resolved: resolvedCount,
      escalated: escalatedCount,
      critical: criticalCount,
      refundsXaf: totalRefunds._sum.refundAmountXaf ?? 0,
      avgResolutionHours: Number(avgResolutionHours.toFixed(2)),
    };
  }

  // ── Single ────────────────────────────────────────────────────────
  async findOne(id: string, user: Principal) {
    const dispute = await this.prisma.dispute.findUnique({
      where: { id },
      include: {
        client: { select: { id: true, name: true, phone: true, email: true } },
        order: {
          include: {
            cook: { select: { id: true, name: true } },
            items: { include: { menuItem: true } },
            payment: true,
          },
        },
        messages: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!dispute) throw new NotFoundException('Litige introuvable');

    // Access control: admin OR owner (client/cook/rider)
    if (!isAdminPrincipal(user)) {
      const isParty =
        dispute.clientId === user.id ||
        dispute.cookId === user.id ||
        dispute.riderId === user.id;
      if (!isParty) throw new ForbiddenException('Accès refusé');
    }

    return dispute;
  }

  // ── Create (by client, cook or rider) ─────────────────────────────
  async create(user: Principal, dto: CreateDisputeDto) {
    const order = await this.prisma.order.findUnique({
      where: { id: dto.orderId },
      select: { id: true, clientId: true, cookId: true, riderId: true },
    });
    if (!order) throw new NotFoundException('Commande introuvable');

    const isClient = order.clientId === user.id;
    const isCook = order.cookId === user.id;
    const isRider = order.riderId === user.id;
    if (!isClient && !isCook && !isRider && !isAdminPrincipal(user)) {
      throw new ForbiddenException('Vous n\'êtes pas lié à cette commande');
    }

    // Only the client is the "reporter" on the schema's clientId; if a
    // cook/rider opens the dispute, we still attach the order's client.
    return this.prisma.dispute.create({
      data: {
        orderId: order.id,
        clientId: order.clientId,
        cookId: order.cookId,
        riderId: order.riderId,
        type: dto.type,
        severity: dto.severity ?? 'MEDIUM',
        description: dto.description,
        evidence: dto.evidence,
        refundAmountXaf: dto.refundAmountXaf,
        messages: {
          create: {
            authorId: user.id,
            authorRole: isClient
              ? 'CLIENT'
              : isCook
                ? 'COOK'
                : isRider
                  ? 'RIDER'
                  : 'ADMIN',
            message: dto.description,
          },
        },
      },
      include: { messages: true },
    });
  }

  // ── Update (admin only) ───────────────────────────────────────────
  async update(id: string, dto: UpdateDisputeDto, adminId: string) {
    const existing = await this.prisma.dispute.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Litige introuvable');

    const data: Prisma.DisputeUpdateInput = { ...dto };

    if (dto.status === DisputeStatus.RESOLVED) {
      data.resolvedAt = new Date();
      if (!dto.resolution && !existing.resolution) {
        throw new BadRequestException(
          'Une résolution est requise pour clôturer le litige',
        );
      }
    }
    if (dto.assignedTo === undefined && !existing.assignedTo) {
      data.assignedTo = adminId;
    }

    return this.prisma.dispute.update({ where: { id }, data });
  }

  // ── Add message (any party) ───────────────────────────────────────
  async addMessage(id: string, user: Principal, dto: AddDisputeMessageDto) {
    const dispute = await this.findOne(id, user);

    const role =
      dto.authorRole ??
      (isAdminPrincipal(user)
        ? 'ADMIN'
        : dispute.clientId === user.id
          ? 'CLIENT'
          : dispute.cookId === user.id
            ? 'COOK'
            : dispute.riderId === user.id
              ? 'RIDER'
              : 'CLIENT');

    return this.prisma.disputeMessage.create({
      data: {
        disputeId: id,
        authorId: user.id,
        authorRole: role,
        message: dto.message,
      },
    });
  }

  // ── User-facing list ──────────────────────────────────────────────
  async findMine(userId: string) {
    return this.prisma.dispute.findMany({
      where: {
        OR: [{ clientId: userId }, { cookId: userId }, { riderId: userId }],
      },
      orderBy: { createdAt: 'desc' },
      include: {
        order: { select: { id: true, totalXaf: true, status: true } },
        _count: { select: { messages: true } },
      },
    });
  }
}
