import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { OrderStatus, Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EventsService } from '../events/events.service';
import {
  InterveneOrderDto,
  PatchAdminUserDto,
  QueryAdminUsersLiveDto,
  QueryCustomReportDto,
} from './dto/admin-live.dto';
import { paginatedResult, paginationParams } from '../common/pagination.helper';

// Terminal = commande finie (ne compte plus comme "in-flight")
const TERMINAL_STATUSES: OrderStatus[] = [
  OrderStatus.DELIVERED,
  OrderStatus.CANCELLED,
];

const IN_FLIGHT_STATUSES: OrderStatus[] = [
  OrderStatus.PENDING,
  OrderStatus.CONFIRMED,
  OrderStatus.PREPARING,
  OrderStatus.READY,
  OrderStatus.ASSIGNED,
  OrderStatus.PICKED_UP,
  OrderStatus.DELIVERING,
];

const RIDER_ONLINE_CUTOFF_MIN = 5; // < 5 min lastSeenAt => online

@Injectable()
export class AdminLiveService {
  private readonly logger = new Logger(AdminLiveService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsService,
  ) {}

  // ============================================================
  // 1) /admin/live/overview
  // ============================================================

  async getOverview() {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [
      activeClients,
      activeRiders,
      ordersInProgressByStatus,
      todayDelivered,
      todayOrdersCount,
      delivered24h,
      weeklyOrders,
    ] = await Promise.all([
      // clients distinct qui ont au moins 1 order non-terminal
      this.prisma.order.findMany({
        where: { status: { in: IN_FLIGHT_STATUSES } },
        select: { clientId: true },
        distinct: ['clientId'],
      }),
      // riders online
      this.prisma.riderProfile.count({ where: { isOnline: true } }),
      // orders in-flight groupés par statut
      this.prisma.order.groupBy({
        by: ['status'],
        _count: { _all: true },
        where: { status: { in: IN_FLIGHT_STATUSES } },
      }),
      // revenue today (DELIVERED aujourd'hui)
      this.prisma.order.findMany({
        where: {
          status: OrderStatus.DELIVERED,
          deliveredAt: { gte: todayStart },
        },
        select: { totalXaf: true },
      }),
      // count total today
      this.prisma.order.count({
        where: { createdAt: { gte: todayStart } },
      }),
      // avg delivery time last 24h (PENDING -> DELIVERED)
      this.prisma.order.findMany({
        where: {
          status: OrderStatus.DELIVERED,
          deliveredAt: { gte: last24h },
        },
        select: { createdAt: true, deliveredAt: true },
      }),
      // last 7d createdAt for peak hour
      this.prisma.order.findMany({
        where: { createdAt: { gte: last7d } },
        select: { createdAt: true },
      }),
    ]);

    // activeCooks = cooks ayant au moins un in-flight order
    const activeCooksRows = await this.prisma.order.findMany({
      where: { status: { in: IN_FLIGHT_STATUSES } },
      select: { cookId: true },
      distinct: ['cookId'],
    });

    // Reformat groupBy
    const ordersInProgress: Record<string, number> = {};
    for (const row of ordersInProgressByStatus) {
      ordersInProgress[row.status] = row._count._all;
    }
    // fill zeros for well-known statuses so dashboard always gets keys
    for (const st of IN_FLIGHT_STATUSES) {
      if (!(st in ordersInProgress)) ordersInProgress[st] = 0;
    }

    const todayRevenue = todayDelivered.reduce((acc, o) => acc + o.totalXaf, 0);

    // avg delivery time (minutes)
    let avgDeliveryTime = 0;
    if (delivered24h.length > 0) {
      const totalMs = delivered24h.reduce((acc, o) => {
        if (!o.deliveredAt) return acc;
        return acc + (o.deliveredAt.getTime() - o.createdAt.getTime());
      }, 0);
      avgDeliveryTime = Math.round(totalMs / delivered24h.length / 60000);
    }

    // peak hour prediction: bucket weekly orders by hour-of-day
    const buckets = new Array(24).fill(0);
    for (const o of weeklyOrders) {
      buckets[o.createdAt.getHours()]++;
    }
    let peakHour = 0;
    let peakCount = 0;
    buckets.forEach((c, h) => {
      if (c > peakCount) {
        peakCount = c;
        peakHour = h;
      }
    });

    return {
      activeClients: activeClients.length,
      activeRiders,
      activeCooks: activeCooksRows.length,
      ordersInProgress,
      todayRevenue,
      todayOrdersCount,
      avgDeliveryTime,
      peakHourPrediction: {
        hour: peakHour,
        ordersInLast7Days: peakCount,
        hourlyBuckets: buckets,
      },
      generatedAt: new Date().toISOString(),
    };
  }

  // ============================================================
  // 2) /admin/live/map
  // ============================================================

  async getLiveMap() {
    const [ridersRaw, cooksRaw, activeOrdersRaw] = await Promise.all([
      // Online riders with last known location
      this.prisma.riderProfile.findMany({
        where: { isOnline: true },
        select: {
          id: true,
          userId: true,
          vehicleType: true,
          lastLocationLat: true,
          lastLocationLng: true,
          user: { select: { id: true, name: true, avatarUrl: true } },
        },
      }),
      this.prisma.cookProfile.findMany({
        where: { isActive: true },
        select: {
          id: true,
          userId: true,
          displayName: true,
          avgRating: true,
          locationLat: true,
          locationLng: true,
          isRush: true,
          user: { select: { id: true, name: true } },
        },
      }),
      this.prisma.order.findMany({
        where: { status: { in: IN_FLIGHT_STATUSES } },
        select: {
          id: true,
          status: true,
          totalXaf: true,
          deliveryLat: true,
          deliveryLng: true,
          cookId: true,
          riderId: true,
          client: { select: { id: true, name: true } },
        },
      }),
    ]);

    // Pending orders per cook (for their marker)
    const pendingByCookUser = await this.prisma.order.groupBy({
      by: ['cookId'],
      _count: { _all: true },
      where: { status: { in: IN_FLIGHT_STATUSES } },
    });
    const pendingMap = new Map<string, number>();
    for (const row of pendingByCookUser) {
      pendingMap.set(row.cookId, row._count._all);
    }

    // active orderId per rider (for rider marker)
    const riderOrderMap = new Map<string, string>();
    for (const o of activeOrdersRaw) {
      if (o.riderId) riderOrderMap.set(o.riderId, o.id);
    }

    const riders = ridersRaw.map((r) => ({
      id: r.user.id,
      name: r.user.name ?? 'Livreur',
      avatarUrl: r.user.avatarUrl,
      lat: r.lastLocationLat,
      lng: r.lastLocationLng,
      vehicleType: r.vehicleType,
      currentOrderId: riderOrderMap.get(r.user.id) ?? null,
      status: 'online',
    }));

    const cooks = cooksRaw.map((c) => ({
      id: c.user.id,
      name: c.displayName ?? c.user.name ?? 'Restaurant',
      lat: c.locationLat,
      lng: c.locationLng,
      pendingOrdersCount: pendingMap.get(c.user.id) ?? 0,
      avgRating: c.avgRating,
      isOpen: !c.isRush,
    }));

    const activeOrders = activeOrdersRaw.map((o) => ({
      id: o.id,
      clientName: o.client.name ?? 'Client',
      clientLat: o.deliveryLat,
      clientLng: o.deliveryLng,
      cookId: o.cookId,
      riderId: o.riderId,
      status: o.status,
      totalXaf: o.totalXaf,
    }));

    return { riders, cooks, activeOrders, generatedAt: new Date().toISOString() };
  }

  // ============================================================
  // 5) /admin/users/live
  // ============================================================

  async getUsersLive(query: QueryAdminUsersLiveDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 25;
    const { skip, take } = paginationParams(page, limit);
    const onlineOnly = query.onlineOnly === 'true';

    const where: Prisma.UserWhereInput = {};
    if (query.role) where.role = query.role;
    if (query.city) {
      where.quarter = { city: query.city };
    }

    // For online filter we'll post-filter because "online" is derived from
    // RiderProfile.isOnline OR a recent Order activity.
    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        include: {
          riderProfile: {
            select: {
              isOnline: true,
              lastSeenAt: true,
              lastLocationLat: true,
              lastLocationLng: true,
              avgRating: true,
              totalTrips: true,
            },
          },
          cookProfile: {
            select: {
              avgRating: true,
              totalOrders: true,
              isActive: true,
              locationLat: true,
              locationLng: true,
            },
          },
          quarter: { select: { name: true, city: true } },
        },
        orderBy:
          query.sortBy === 'name'
            ? { name: 'asc' }
            : query.sortBy === 'lastSeenAt'
              ? { updatedAt: 'desc' }
              : { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.user.count({ where }),
    ]);

    // Grab recent in-flight order per user (client-side aggregate)
    const clientOrderMap = new Map<string, string>();
    if (users.some((u) => u.role === UserRole.CLIENT)) {
      const clientIds = users.filter((u) => u.role === UserRole.CLIENT).map((u) => u.id);
      if (clientIds.length > 0) {
        const inflight = await this.prisma.order.findMany({
          where: {
            clientId: { in: clientIds },
            status: { in: IN_FLIGHT_STATUSES },
          },
          select: { id: true, clientId: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
        });
        for (const o of inflight) {
          if (!clientOrderMap.has(o.clientId)) clientOrderMap.set(o.clientId, o.id);
        }
      }
    }

    // Total orders per user as client (fast count)
    const orderCounts: Record<string, number> = {};
    for (const u of users) {
      if (u.role === UserRole.CLIENT) {
        orderCounts[u.id] = await this.prisma.order.count({ where: { clientId: u.id } });
      }
    }

    let data = users.map((u) => {
      const isOnline = this.computeIsOnline(u);
      const lastSeen = u.riderProfile?.lastSeenAt ?? u.updatedAt;

      let location: { lat: number | null; lng: number | null } | null = null;
      if (u.riderProfile?.lastLocationLat != null) {
        location = { lat: u.riderProfile.lastLocationLat, lng: u.riderProfile.lastLocationLng };
      } else if (u.cookProfile?.locationLat != null) {
        location = { lat: u.cookProfile.locationLat, lng: u.cookProfile.locationLng };
      } else if (u.locationLat != null) {
        location = { lat: u.locationLat, lng: u.locationLng };
      }

      let currentOrderId: string | null = null;
      if (u.role === UserRole.CLIENT) {
        currentOrderId = clientOrderMap.get(u.id) ?? null;
      }

      const totalOrders =
        u.role === UserRole.CLIENT
          ? (orderCounts[u.id] ?? 0)
          : u.role === UserRole.RIDER
            ? (u.riderProfile?.totalTrips ?? 0)
            : u.role === UserRole.COOK
              ? (u.cookProfile?.totalOrders ?? 0)
              : 0;

      const avgRating =
        u.role === UserRole.RIDER
          ? (u.riderProfile?.avgRating ?? 0)
          : u.role === UserRole.COOK
            ? (u.cookProfile?.avgRating ?? 0)
            : 0;

      return {
        id: u.id,
        name: u.name,
        phone: u.phone,
        avatarUrl: u.avatarUrl,
        role: u.role,
        status: isOnline ? 'online' : 'offline',
        lastSeenAt: lastSeen,
        location,
        currentOrderId,
        city: u.quarter?.city ?? null,
        quarter: u.quarter?.name ?? null,
        stats: { totalOrders, avgRating },
      };
    });

    if (onlineOnly) data = data.filter((u) => u.status === 'online');
    if (query.status) {
      data = data.filter((u) => u.status === query.status);
    }

    return paginatedResult(data, total, page, limit);
  }

  private computeIsOnline(u: {
    role: UserRole;
    riderProfile?: { isOnline: boolean; lastSeenAt: Date | null } | null;
    updatedAt: Date;
  }): boolean {
    if (u.role === UserRole.RIDER) {
      return !!u.riderProfile?.isOnline;
    }
    // heuristique : activité dans les 5 min
    const cutoff = Date.now() - RIDER_ONLINE_CUTOFF_MIN * 60 * 1000;
    return u.updatedAt.getTime() >= cutoff;
  }

  // ============================================================
  // 6) PATCH /admin/users/:id
  // ============================================================

  async patchUser(userId: string, dto: PatchAdminUserDto, adminId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Utilisateur introuvable');

    switch (dto.action) {
      case 'suspend': {
        // We flag the user as suspended via riderProfile.isOnline=false and
        // cookProfile.isActive=false (the real domain flags). We also store
        // the reason in the audit log.
        if (user.role === UserRole.RIDER) {
          await this.prisma.riderProfile.updateMany({
            where: { userId },
            data: { isOnline: false, isVerified: false },
          });
        } else if (user.role === UserRole.COOK) {
          await this.prisma.cookProfile.updateMany({
            where: { userId },
            data: { isActive: false },
          });
        }
        await this.prisma.adminAuditLog.create({
          data: {
            adminId,
            action: 'user.suspend',
            target: userId,
            details: dto.reason ?? null,
          },
        });
        this.events.emitToAdmin('admin:user:suspended', {
          userId,
          reason: dto.reason,
          at: new Date().toISOString(),
        });
        return { ok: true, action: 'suspend', userId };
      }
      case 'reactivate': {
        if (user.role === UserRole.RIDER) {
          await this.prisma.riderProfile.updateMany({
            where: { userId },
            data: { isVerified: true },
          });
        } else if (user.role === UserRole.COOK) {
          await this.prisma.cookProfile.updateMany({
            where: { userId },
            data: { isActive: true },
          });
        }
        await this.prisma.adminAuditLog.create({
          data: {
            adminId,
            action: 'user.reactivate',
            target: userId,
            details: dto.reason ?? null,
          },
        });
        this.events.emitToAdmin('admin:user:reactivated', {
          userId,
          at: new Date().toISOString(),
        });
        return { ok: true, action: 'reactivate', userId };
      }
      case 'force_reconnect': {
        // Nudge all sockets owned by this user to drop & reconnect.
        const role = user.role.toLowerCase();
        // emit both to colon/hyphen variants
        const payload = {
          reason: dto.reason ?? 'admin_requested_reconnect',
          at: new Date().toISOString(),
        };
        this.events.emitToAdmin('admin:user:force_reconnect', {
          userId,
          ...payload,
        });
        // personal rooms
        const server = (this.events as unknown as { server: unknown });
        void server; // not needed; use EventsService helpers
        // Use notify* to target the user's room
        if (user.role === UserRole.RIDER) this.events.notifyRider(userId, 'force:reconnect', payload);
        if (user.role === UserRole.COOK) this.events.notifyCook(userId, 'force:reconnect', payload);
        if (user.role === UserRole.CLIENT) this.events.notifyClient(userId, 'force:reconnect', payload);
        await this.prisma.adminAuditLog.create({
          data: {
            adminId,
            action: 'user.force_reconnect',
            target: userId,
            details: dto.reason ?? null,
          },
        });
        return { ok: true, action: 'force_reconnect', userId, role };
      }
    }
  }

  // ============================================================
  // 7) POST /admin/orders/:id/intervene
  // ============================================================

  async interveneOnOrder(
    orderId: string,
    dto: InterveneOrderDto,
    adminId: string,
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        clientId: true,
        cookId: true,
        riderId: true,
        status: true,
        totalXaf: true,
      },
    });
    if (!order) throw new NotFoundException('Commande introuvable');

    // Persist intervention trace (all actions).
    const interventionPromise = this.prisma.orderIntervention.create({
      data: {
        orderId,
        adminId,
        action: dto.action,
        reason: dto.reason,
        payload: dto.payload ? JSON.stringify(dto.payload) : null,
      },
    });

    let result: Record<string, unknown> = {};

    switch (dto.action) {
      case 'force_cancel': {
        await this.prisma.order.update({
          where: { id: orderId },
          data: {
            status: OrderStatus.CANCELLED,
            cancelledAt: new Date(),
            cancelReason: `[admin] ${dto.reason}`,
          },
        });
        const payload = {
          orderId,
          status: OrderStatus.CANCELLED,
          reason: dto.reason,
          by: 'admin',
        };
        this.events.notifyClient(order.clientId, 'order:status', payload);
        this.events.notifyCook(order.cookId, 'order:status', payload);
        if (order.riderId)
          this.events.notifyRider(order.riderId, 'order:status', payload);
        result = { cancelled: true };
        break;
      }
      case 'reassign_rider': {
        const newRiderId = (dto.payload?.riderId as string | undefined) ?? null;
        if (!newRiderId)
          throw new BadRequestException('payload.riderId requis pour reassign_rider');
        await this.prisma.order.update({
          where: { id: orderId },
          data: { riderId: newRiderId, assignedAt: new Date() },
        });
        const payload = { orderId, newRiderId, oldRiderId: order.riderId, by: 'admin' };
        if (order.riderId)
          this.events.notifyRider(order.riderId, 'order:unassigned', payload);
        this.events.notifyRider(newRiderId, 'order:assigned', payload);
        this.events.notifyClient(order.clientId, 'delivery:status', payload);
        result = { newRiderId };
        break;
      }
      case 'extend_deadline': {
        const addMinutes = Number(dto.payload?.minutes ?? 15);
        const payload = { orderId, addMinutes, reason: dto.reason };
        this.events.notifyClient(order.clientId, 'order:deadline_extended', payload);
        this.events.notifyCook(order.cookId, 'order:deadline_extended', payload);
        if (order.riderId)
          this.events.notifyRider(order.riderId, 'order:deadline_extended', payload);
        result = { addMinutes };
        break;
      }
      case 'refund': {
        const amountXaf = Number(dto.payload?.amountXaf ?? order.totalXaf);
        await this.prisma.payment
          .updateMany({
            where: { orderId },
            data: { status: 'FAILED', failureReason: `[admin-refund] ${dto.reason}` },
          })
          .catch(() => undefined);
        const payload = { orderId, amountXaf, reason: dto.reason };
        this.events.notifyClient(order.clientId, 'order:refunded', payload);
        result = { refundedXaf: amountXaf };
        break;
      }
      case 'notify_all': {
        const message = (dto.payload?.message as string) ?? dto.reason;
        const payload = { orderId, message, by: 'admin' };
        this.events.notifyClient(order.clientId, 'order:admin_message', payload);
        this.events.notifyCook(order.cookId, 'order:admin_message', payload);
        if (order.riderId)
          this.events.notifyRider(order.riderId, 'order:admin_message', payload);
        result = { notified: true };
        break;
      }
    }

    const [intervention] = await Promise.all([interventionPromise]);

    this.events.emitToAdmin('admin:order:intervention', {
      intervention: {
        id: intervention.id,
        orderId,
        action: dto.action,
        reason: dto.reason,
        adminId,
        createdAt: intervention.createdAt,
      },
      result,
    });

    return {
      ok: true,
      intervention: {
        id: intervention.id,
        orderId,
        action: dto.action,
        reason: dto.reason,
        payload: dto.payload ?? null,
        createdAt: intervention.createdAt,
      },
      result,
    };
  }

  // ============================================================
  // 8) GET /admin/reports/custom
  // ============================================================

  async buildCustomReport(query: QueryCustomReportDto) {
    const from = new Date(query.from);
    const to = new Date(query.to);
    if (isNaN(from.getTime()) || isNaN(to.getTime())) {
      throw new BadRequestException('from / to invalides (ISO 8601 attendu)');
    }
    if (from > to) {
      throw new BadRequestException('from doit précéder to');
    }

    const where: Prisma.OrderWhereInput = {
      createdAt: { gte: from, lte: to },
    };
    if (query.status) where.status = query.status;
    if (query.riderId) where.riderId = query.riderId;
    if (query.restaurantId) {
      // restaurantId = cookProfile.id → user
      const cookProfile = await this.prisma.cookProfile.findUnique({
        where: { id: query.restaurantId },
        select: { userId: true },
      });
      if (cookProfile) where.cookId = cookProfile.userId;
    }

    const orders = await this.prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        status: true,
        totalXaf: true,
        deliveryFeeXaf: true,
        paymentMethod: true,
        paymentStatus: true,
        createdAt: true,
        deliveredAt: true,
        cancelledAt: true,
        client: { select: { id: true, name: true, phone: true } },
        cook: { select: { id: true, name: true } },
        rider: { select: { id: true, name: true } },
      },
    });

    const totalRevenue = orders
      .filter((o) => o.status === OrderStatus.DELIVERED)
      .reduce((acc, o) => acc + o.totalXaf, 0);

    return {
      rows: orders.map((o) => ({
        id: o.id,
        status: o.status,
        client: o.client.name ?? '-',
        clientPhone: o.client.phone,
        cook: o.cook.name ?? '-',
        rider: o.rider?.name ?? '-',
        totalXaf: o.totalXaf,
        deliveryFeeXaf: o.deliveryFeeXaf,
        paymentMethod: o.paymentMethod,
        paymentStatus: o.paymentStatus,
        createdAt: o.createdAt.toISOString(),
        deliveredAt: o.deliveredAt?.toISOString() ?? '',
        cancelledAt: o.cancelledAt?.toISOString() ?? '',
      })),
      summary: {
        totalOrders: orders.length,
        totalRevenueXaf: totalRevenue,
        from: from.toISOString(),
        to: to.toISOString(),
      },
    };
  }
}
