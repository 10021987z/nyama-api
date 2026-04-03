import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DeliveryStatus, OrderStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { paginatedResult, paginationParams } from '../common/pagination.helper';
import {
  QueryAdminUsersDto,
  QueryAdminOrdersDto,
  QueryAdminRestaurantsDto,
  QueryAdminDeliveriesDto,
  QueryAdminFleetDto,
} from './dto/query-admin.dto';

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  // ============================================================
  // DASHBOARD
  // ============================================================

  async getDashboard() {
    const now = new Date();

    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - 7);

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Same day last week for trend comparison
    const sameDayLastWeekStart = new Date(todayStart);
    sameDayLastWeekStart.setDate(sameDayLastWeekStart.getDate() - 7);
    const sameDayLastWeekEnd = new Date(sameDayLastWeekStart);
    sameDayLastWeekEnd.setHours(23, 59, 59, 999);

    // Yesterday for revenue trend
    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    const yesterdayEnd = new Date(yesterdayStart);
    yesterdayEnd.setHours(23, 59, 59, 999);

    const [
      totalOrders,
      totalUsers,
      totalCooks,
      totalRiders,
      ordersToday,
      allDeliveredOrders,
      ordersTodayData,
      ordersThisWeekCount,
      deliveredThisWeek,
      deliveredThisMonth,
      cancelledCount,
      totalPayments,
      successPayments,
      newUsersThisMonth,
      totalClients,
      sameDayLastWeekOrders,
      yesterdayDelivered,
      todayAllOrders,
      ordersByStatusRaw,
      paymentMethodsRaw,
    ] = await Promise.all([
      // Existing KPIs
      this.prisma.order.count(),
      this.prisma.user.count(),
      this.prisma.cookProfile.count({ where: { isActive: true } }),
      this.prisma.riderProfile.count({ where: { isVerified: true } }),
      this.prisma.order.count({ where: { createdAt: { gte: todayStart } } }),
      this.prisma.order.findMany({
        where: { status: OrderStatus.DELIVERED },
        select: { totalXaf: true },
      }),
      // Revenue today (delivered today)
      this.prisma.order.findMany({
        where: { status: OrderStatus.DELIVERED, createdAt: { gte: todayStart } },
        select: { totalXaf: true },
      }),
      // Orders this week
      this.prisma.order.count({ where: { createdAt: { gte: weekStart } } }),
      // Revenue this week (delivered orders created this week)
      this.prisma.order.findMany({
        where: { status: OrderStatus.DELIVERED, createdAt: { gte: weekStart } },
        select: { totalXaf: true },
      }),
      // Revenue this month
      this.prisma.order.findMany({
        where: { status: OrderStatus.DELIVERED, createdAt: { gte: monthStart } },
        select: { totalXaf: true },
      }),
      // Cancelled count (for delivery success rate)
      this.prisma.order.count({ where: { status: OrderStatus.CANCELLED } }),
      // Total payments
      this.prisma.payment.count(),
      // Successful payments
      this.prisma.payment.count({ where: { status: 'SUCCESS' } }),
      // New users this month
      this.prisma.user.count({ where: { createdAt: { gte: monthStart } } }),
      // Total clients
      this.prisma.user.count({ where: { role: 'CLIENT' } }),
      // Same day last week orders count (for trend)
      this.prisma.order.count({
        where: { createdAt: { gte: sameDayLastWeekStart, lte: sameDayLastWeekEnd } },
      }),
      // Yesterday delivered revenue (for trend)
      this.prisma.order.findMany({
        where: {
          status: OrderStatus.DELIVERED,
          createdAt: { gte: yesterdayStart, lte: yesterdayEnd },
        },
        select: { totalXaf: true },
      }),
      // Today all orders with hour for hourly breakdown
      this.prisma.order.findMany({
        where: { createdAt: { gte: todayStart } },
        select: { totalXaf: true, createdAt: true },
      }),
      // Orders grouped by status
      this.prisma.order.groupBy({
        by: ['status'],
        _count: { id: true },
      }),
      // Payment methods breakdown
      this.prisma.payment.groupBy({
        by: ['method'],
        _count: { id: true },
      }),
    ]);

    // Compute existing KPIs
    const totalRevenue = allDeliveredOrders.reduce((s, o) => s + o.totalXaf, 0);
    const revenueToday = ordersTodayData.reduce((s, o) => s + o.totalXaf, 0);
    const deliveredCount = allDeliveredOrders.length;

    // Avg rating
    const cookRatings = await this.prisma.cookProfile.findMany({
      where: { avgRating: { gt: 0 } },
      select: { avgRating: true },
    });
    const avgRating =
      cookRatings.length > 0
        ? Math.round(
            (cookRatings.reduce((s, c) => s + c.avgRating, 0) / cookRatings.length) * 10,
          ) / 10
        : 0;

    // New KPIs
    const revenueThisWeek = deliveredThisWeek.reduce((s, o) => s + o.totalXaf, 0);
    const revenueThisMonth = deliveredThisMonth.reduce((s, o) => s + o.totalXaf, 0);
    const avgBasketXaf = deliveredCount > 0 ? Math.round(totalRevenue / deliveredCount) : 0;
    const deliverySuccessRate =
      deliveredCount + cancelledCount > 0
        ? Math.round((deliveredCount / (deliveredCount + cancelledCount)) * 10000) / 100
        : 0;
    const paymentSuccessRate =
      totalPayments > 0
        ? Math.round((successPayments / totalPayments) * 10000) / 100
        : 0;

    // Active clients last 30 days
    const activeClientsRaw = await this.prisma.order.findMany({
      where: { createdAt: { gte: thirtyDaysAgo } },
      select: { clientId: true },
      distinct: ['clientId'],
    });
    const activeClientsLast30d = activeClientsRaw.length;

    const retentionRate =
      totalClients > 0
        ? Math.round((activeClientsLast30d / totalClients) * 10000) / 100
        : 0;

    // Trends
    const ordersTrend =
      sameDayLastWeekOrders > 0
        ? Math.round(((ordersToday - sameDayLastWeekOrders) / sameDayLastWeekOrders) * 10000) / 100
        : 0;

    const yesterdayRevenue = yesterdayDelivered.reduce((s, o) => s + o.totalXaf, 0);
    const revenueTrend =
      yesterdayRevenue > 0
        ? Math.round(((revenueToday - yesterdayRevenue) / yesterdayRevenue) * 10000) / 100
        : 0;

    // Hourly orders (24 entries)
    const hourlyMap = new Map<number, { orders: number; revenue: number }>();
    for (let h = 0; h < 24; h++) {
      hourlyMap.set(h, { orders: 0, revenue: 0 });
    }
    for (const order of todayAllOrders) {
      const hour = new Date(order.createdAt).getHours();
      const entry = hourlyMap.get(hour)!;
      entry.orders++;
      entry.revenue += order.totalXaf;
    }
    const hourlyOrders = Array.from(hourlyMap.entries()).map(([h, data]) => ({
      hour: `${String(h).padStart(2, '0')}:00`,
      orders: data.orders,
      revenue: data.revenue,
    }));

    // Revenue by quarter (from delivered orders, joined with cook's quarter)
    const deliveredWithQuarter = await this.prisma.order.findMany({
      where: { status: OrderStatus.DELIVERED },
      select: {
        totalXaf: true,
        cook: {
          select: {
            cookProfile: {
              select: {
                quarter: { select: { name: true, city: true } },
              },
            },
          },
        },
      },
    });

    const quarterMap = new Map<string, { quarterName: string; city: string; revenue: number; orders: number }>();
    for (const o of deliveredWithQuarter) {
      const quarter = o.cook?.cookProfile?.quarter;
      if (!quarter) continue;
      const key = `${quarter.name}-${quarter.city}`;
      if (!quarterMap.has(key)) {
        quarterMap.set(key, { quarterName: quarter.name, city: quarter.city, revenue: 0, orders: 0 });
      }
      const entry = quarterMap.get(key)!;
      entry.revenue += o.totalXaf;
      entry.orders++;
    }
    const revenueByQuarter = Array.from(quarterMap.values());

    // Orders by status
    const ordersByStatus: Record<string, number> = {};
    for (const entry of ordersByStatusRaw) {
      ordersByStatus[entry.status] = entry._count.id;
    }

    // Payment method breakdown
    const totalPaymentCount = paymentMethodsRaw.reduce((s, e) => s + e._count.id, 0);
    const paymentMethodBreakdown = paymentMethodsRaw.map((e) => ({
      method: e.method,
      count: e._count.id,
      percentage:
        totalPaymentCount > 0
          ? Math.round((e._count.id / totalPaymentCount) * 10000) / 100
          : 0,
    }));

    return {
      // Existing KPIs
      totalOrders,
      totalRevenue,
      totalUsers,
      totalCooks,
      totalRiders,
      ordersToday,
      revenueToday,
      avgRating,

      // New KPIs
      ordersThisWeek: ordersThisWeekCount,
      revenueThisWeek,
      revenueThisMonth,
      avgBasketXaf,
      deliverySuccessRate,
      paymentSuccessRate,
      newUsersThisMonth,
      activeClientsLast30d,
      retentionRate,

      // Trends
      ordersTrend,
      revenueTrend,

      // Charts
      hourlyOrders,
      revenueByQuarter,
      ordersByStatus,
      paymentMethodBreakdown,
    };
  }

  // ============================================================
  // USERS (existing)
  // ============================================================

  async getUsers(dto: QueryAdminUsersDto) {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    const { skip, take } = paginationParams(page, limit);

    const where: Prisma.UserWhereInput = {
      ...(dto.role ? { role: dto.role } : {}),
      ...(dto.search
        ? {
            OR: [
              { name: { contains: dto.search } },
              { phone: { contains: dto.search } },
            ],
          }
        : {}),
    };

    const [total, users] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        include: { quarter: { select: { name: true, city: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
    ]);

    // If filtering by CLIENT role, enrich with order data
    const isClientQuery = dto.role === 'CLIENT';

    if (isClientQuery && users.length > 0) {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);

      const userIds = users.map((u) => u.id);

      const [orderCounts, spentData, lastOrders, recentOrderClients] = await Promise.all([
        this.prisma.order.groupBy({
          by: ['clientId'],
          where: { clientId: { in: userIds } },
          _count: { id: true },
        }),
        this.prisma.order.groupBy({
          by: ['clientId'],
          where: { clientId: { in: userIds }, status: OrderStatus.DELIVERED },
          _sum: { totalXaf: true },
        }),
        this.prisma.order.groupBy({
          by: ['clientId'],
          where: { clientId: { in: userIds } },
          _max: { createdAt: true },
        }),
        this.prisma.order.findMany({
          where: { clientId: { in: userIds }, createdAt: { gte: thirtyDaysAgo } },
          select: { clientId: true },
          distinct: ['clientId'],
        }),
      ]);

      const countMap = new Map(orderCounts.map((r) => [r.clientId, r._count.id]));
      const spentMap = new Map(spentData.map((r) => [r.clientId, r._sum.totalXaf ?? 0]));
      const lastMap = new Map(lastOrders.map((r) => [r.clientId, r._max.createdAt]));
      const activeSet = new Set(recentOrderClients.map((r) => r.clientId));

      const data = users.map((user) => ({
        ...user,
        totalOrders: countMap.get(user.id) ?? 0,
        totalSpentXaf: spentMap.get(user.id) ?? 0,
        lastOrderAt: lastMap.get(user.id) ?? null,
        status: activeSet.has(user.id) ? 'ACTIF' as const : 'INACTIF' as const,
      }));

      // Global client stats
      const [totalClients, activeClients30d, newClientsThisMonth] = await Promise.all([
        this.prisma.user.count({ where: { role: 'CLIENT' } }),
        this.prisma.order.findMany({
          where: { createdAt: { gte: thirtyDaysAgo } },
          select: { clientId: true },
          distinct: ['clientId'],
        }).then((r) => r.length),
        this.prisma.user.count({ where: { role: 'CLIENT', createdAt: { gte: monthStart } } }),
      ]);

      const retentionRate = totalClients > 0
        ? Math.round((activeClients30d / totalClients) * 10000) / 100
        : 0;

      return {
        ...paginatedResult(data, total, page, limit),
        stats: {
          totalClients,
          activeClients30d,
          newClientsThisMonth,
          retentionRate,
        },
      };
    }

    return paginatedResult(users, total, page, limit);
  }

  // ============================================================
  // ORDERS (existing)
  // ============================================================

  async getOrders(dto: QueryAdminOrdersDto) {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    const { skip, take } = paginationParams(page, limit);

    const where: Prisma.OrderWhereInput = {
      ...(dto.status ? { status: dto.status } : {}),
      ...(dto.from || dto.to
        ? {
            createdAt: {
              ...(dto.from ? { gte: new Date(dto.from) } : {}),
              ...(dto.to ? { lte: new Date(`${dto.to}T23:59:59Z`) } : {}),
            },
          }
        : {}),
    };

    const [total, data] = await Promise.all([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        include: {
          client: { select: { name: true, phone: true } },
          cook: { select: { name: true } },
          rider: { select: { name: true } },
          payment: { select: { status: true, method: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
    ]);

    return paginatedResult(data, total, page, limit);
  }

  // ============================================================
  // RESTAURANTS
  // ============================================================

  async getRestaurants(dto: QueryAdminRestaurantsDto) {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    const { skip, take } = paginationParams(page, limit);

    // Build where clause for CookProfile
    const where: Prisma.CookProfileWhereInput = {};

    if (dto.quarter_id) {
      where.quarterId = dto.quarter_id;
    }

    if (dto.search) {
      where.displayName = { contains: dto.search };
    }

    if (dto.category) {
      where.specialty = { contains: dto.category };
    }

    // Status filter maps to isActive/isVerified
    if (dto.status === 'OUVERT') {
      where.isActive = true;
      where.isVerified = true;
    } else if (dto.status === 'FERMÉ') {
      where.isActive = false;
      where.isVerified = true;
    } else if (dto.status === 'EN_ATTENTE') {
      where.isVerified = false;
    }

    const [total, cooks] = await Promise.all([
      this.prisma.cookProfile.count({ where }),
      this.prisma.cookProfile.findMany({
        where,
        include: {
          quarter: { select: { name: true, city: true } },
          menuItems: { select: { id: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
    ]);

    // Get revenue + pending orders for each cook in one batch
    const cookIds = cooks.map((c) => c.userId);

    const [revenueData, pendingData] = await Promise.all([
      this.prisma.order.groupBy({
        by: ['cookId'],
        where: { cookId: { in: cookIds }, status: OrderStatus.DELIVERED },
        _sum: { totalXaf: true },
      }),
      this.prisma.order.groupBy({
        by: ['cookId'],
        where: { cookId: { in: cookIds }, status: OrderStatus.PENDING },
        _count: { id: true },
      }),
    ]);

    const revenueMap = new Map(revenueData.map((r) => [r.cookId, r._sum.totalXaf ?? 0]));
    const pendingMap = new Map(pendingData.map((p) => [p.cookId, p._count.id]));

    const data = cooks.map((cook) => {
      let specialty: string[] = [];
      try {
        specialty = JSON.parse(cook.specialty);
      } catch {
        specialty = [cook.specialty];
      }

      let status: 'OUVERT' | 'FERMÉ' | 'EN_ATTENTE';
      if (!cook.isVerified) {
        status = 'EN_ATTENTE';
      } else if (cook.isActive) {
        status = 'OUVERT';
      } else {
        status = 'FERMÉ';
      }

      return {
        id: cook.id,
        displayName: cook.displayName,
        specialty,
        description: cook.description,
        avgRating: cook.avgRating,
        totalOrders: cook.totalOrders,
        isActive: cook.isActive,
        isVerified: cook.isVerified,
        quarter: cook.quarter,
        landmark: cook.landmark,
        locationLat: cook.locationLat,
        locationLng: cook.locationLng,
        momoPhone: cook.momoPhone,
        momoProvider: cook.momoProvider,
        totalRevenue: revenueMap.get(cook.userId) ?? 0,
        pendingOrders: pendingMap.get(cook.userId) ?? 0,
        menuItemsCount: cook.menuItems.length,
        status,
        createdAt: cook.createdAt,
      };
    });

    // Global stats
    const [totalRestaurants, activeRestaurants, pendingRestaurants] = await Promise.all([
      this.prisma.cookProfile.count(),
      this.prisma.cookProfile.count({ where: { isActive: true, isVerified: true } }),
      this.prisma.cookProfile.count({ where: { isVerified: false } }),
    ]);

    const allRatings = await this.prisma.cookProfile.findMany({
      where: { avgRating: { gt: 0 } },
      select: { avgRating: true },
    });
    const statsAvgRating =
      allRatings.length > 0
        ? Math.round((allRatings.reduce((s, c) => s + c.avgRating, 0) / allRatings.length) * 10) / 10
        : 0;

    return {
      ...paginatedResult(data, total, page, limit),
      stats: {
        totalRestaurants,
        activeRestaurants,
        pendingRestaurants,
        avgRating: statsAvgRating,
      },
    };
  }

  // ============================================================
  // DELIVERIES
  // ============================================================

  async getDeliveries(dto: QueryAdminDeliveriesDto) {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    const { skip, take } = paginationParams(page, limit);

    const where: Prisma.DeliveryWhereInput = {};

    if (dto.status) {
      where.status = dto.status;
    }

    if (dto.rider_id) {
      where.riderId = dto.rider_id;
    }

    if (dto.from || dto.to) {
      where.assignedAt = {
        ...(dto.from ? { gte: new Date(dto.from) } : {}),
        ...(dto.to ? { lte: new Date(`${dto.to}T23:59:59Z`) } : {}),
      };
    }

    const [total, deliveries] = await Promise.all([
      this.prisma.delivery.count({ where }),
      this.prisma.delivery.findMany({
        where,
        include: {
          order: {
            select: {
              id: true,
              totalXaf: true,
              deliveryFeeXaf: true,
              deliveryAddress: true,
              clientNote: true,
              client: {
                select: {
                  name: true,
                  phone: true,
                  quarter: { select: { name: true, city: true } },
                },
              },
              cook: {
                select: { name: true },
              },
              items: {
                select: {
                  menuItem: { select: { name: true } },
                  quantity: true,
                },
              },
            },
          },
          rider: {
            select: {
              user: { select: { name: true, phone: true } },
              vehicleType: true,
            },
          },
        },
        orderBy: { assignedAt: 'desc' },
        skip,
        take,
      }),
    ]);

    const data = deliveries.map((d) => ({
      id: d.id,
      orderId: d.orderId,
      order: d.order,
      rider: d.rider,
      status: d.status,
      distanceKm: d.distanceKm,
      estimatedMinutes: d.estimatedMinutes,
      assignedAt: d.assignedAt,
      pickedUpAt: d.pickedUpAt,
      deliveredAt: d.deliveredAt,
      riderEarningXaf: d.riderEarningXaf,
    }));

    // Stats
    const [activeDeliveries, allDeliveries, availableRiders] = await Promise.all([
      this.prisma.delivery.count({ where: { status: { not: DeliveryStatus.DELIVERED } } }),
      this.prisma.delivery.findMany({
        select: { status: true, assignedAt: true, deliveredAt: true },
      }),
      this.prisma.riderProfile.count({ where: { isOnline: true } }),
    ]);

    const deliveredDeliveries = allDeliveries.filter((d) => d.status === DeliveryStatus.DELIVERED);
    const totalDeliveries = allDeliveries.length;

    // Average delivery time (from assignedAt to deliveredAt)
    const deliveryTimes = deliveredDeliveries
      .filter((d) => d.deliveredAt && d.assignedAt)
      .map((d) => (d.deliveredAt!.getTime() - d.assignedAt.getTime()) / 60000);
    const avgDeliveryTimeMin =
      deliveryTimes.length > 0
        ? Math.round(deliveryTimes.reduce((s, t) => s + t, 0) / deliveryTimes.length)
        : 0;

    const deliverySuccessRate =
      totalDeliveries > 0
        ? Math.round((deliveredDeliveries.length / totalDeliveries) * 10000) / 100
        : 0;

    return {
      ...paginatedResult(data, total, page, limit),
      stats: {
        activeDeliveries,
        avgDeliveryTimeMin,
        deliverySuccessRate,
        availableRiders,
      },
    };
  }

  // ============================================================
  // FLEET
  // ============================================================

  async getFleet(dto: QueryAdminFleetDto) {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    const { skip, take } = paginationParams(page, limit);

    const where: Prisma.RiderProfileWhereInput = {};

    if (dto.vehicle_type) {
      where.vehicleType = dto.vehicle_type;
    }

    if (dto.search) {
      where.user = {
        OR: [
          { name: { contains: dto.search } },
          { phone: { contains: dto.search } },
        ],
      };
    }

    // For status filtering, we need to post-filter, but let's pre-filter what we can
    if (dto.status === 'HORS_LIGNE') {
      where.isOnline = false;
    } else if (dto.status === 'EN_LIGNE' || dto.status === 'EN_LIVRAISON') {
      where.isOnline = true;
    }

    const [total, riders] = await Promise.all([
      this.prisma.riderProfile.count({ where }),
      this.prisma.riderProfile.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              phone: true,
              quarter: { select: { name: true, city: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: 0, // We'll handle pagination after post-filtering for status
        take: dto.status === 'EN_LIGNE' || dto.status === 'EN_LIVRAISON' ? undefined : undefined,
      }),
    ]);

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    // Get active deliveries (not DELIVERED) for all riders
    const activeDeliveriesRaw = await this.prisma.delivery.findMany({
      where: { status: { not: DeliveryStatus.DELIVERED } },
      select: { riderId: true },
    });
    const ridersWithActiveDelivery = new Set(activeDeliveriesRaw.map((d) => d.riderId));

    // Today's trips and earnings per rider
    const riderIds = riders.map((r) => r.id);
    const [todayTripsRaw, todayEarningsRaw] = await Promise.all([
      this.prisma.delivery.groupBy({
        by: ['riderId'],
        where: {
          riderId: { in: riderIds },
          status: DeliveryStatus.DELIVERED,
          deliveredAt: { gte: todayStart },
        },
        _count: { id: true },
      }),
      this.prisma.delivery.groupBy({
        by: ['riderId'],
        where: {
          riderId: { in: riderIds },
          status: DeliveryStatus.DELIVERED,
          deliveredAt: { gte: todayStart },
        },
        _sum: { riderEarningXaf: true },
      }),
    ]);

    const todayTripsMap = new Map(todayTripsRaw.map((t) => [t.riderId, t._count.id]));
    const todayEarningsMap = new Map(todayEarningsRaw.map((e) => [e.riderId, e._sum.riderEarningXaf ?? 0]));

    let enrichedData = riders.map((rider) => {
      let status: 'EN_LIVRAISON' | 'EN_LIGNE' | 'HORS_LIGNE';
      if (ridersWithActiveDelivery.has(rider.id)) {
        status = 'EN_LIVRAISON';
      } else if (rider.isOnline) {
        status = 'EN_LIGNE';
      } else {
        status = 'HORS_LIGNE';
      }

      return {
        id: rider.id,
        user: rider.user,
        vehicleType: rider.vehicleType,
        plateNumber: rider.plateNumber,
        isVerified: rider.isVerified,
        isOnline: rider.isOnline,
        avgRating: rider.avgRating,
        totalTrips: rider.totalTrips,
        momoPhone: rider.momoPhone,
        momoProvider: rider.momoProvider,
        createdAt: rider.createdAt,
        todayTrips: todayTripsMap.get(rider.id) ?? 0,
        todayEarnings: todayEarningsMap.get(rider.id) ?? 0,
        status,
      };
    });

    // Post-filter by status if needed
    if (dto.status === 'EN_LIVRAISON') {
      enrichedData = enrichedData.filter((r) => r.status === 'EN_LIVRAISON');
    } else if (dto.status === 'EN_LIGNE') {
      enrichedData = enrichedData.filter((r) => r.status === 'EN_LIGNE');
    }

    // Recalculate total for post-filtered results
    const filteredTotal = (dto.status === 'EN_LIVRAISON' || dto.status === 'EN_LIGNE')
      ? enrichedData.length
      : total;

    // Apply pagination manually
    const paginatedData = enrichedData.slice(skip, skip + take);

    // Global stats
    const [totalRiders, onlineRiders] = await Promise.all([
      this.prisma.riderProfile.count(),
      this.prisma.riderProfile.count({ where: { isOnline: true } }),
    ]);

    const onlineRidersWithDelivery = riders.filter(
      (r) => r.isOnline && ridersWithActiveDelivery.has(r.id),
    ).length;

    const occupancyRate =
      onlineRiders > 0
        ? Math.round((onlineRidersWithDelivery / onlineRiders) * 10000) / 100
        : 0;

    // Avg revenue per rider (total earnings / totalRiders)
    const totalEarnings = await this.prisma.riderEarning.aggregate({
      _sum: { netXaf: true },
    });
    const avgRevenuePerRider =
      totalRiders > 0
        ? Math.round((totalEarnings._sum.netXaf ?? 0) / totalRiders)
        : 0;

    return {
      ...paginatedResult(paginatedData, filteredTotal, page, limit),
      stats: {
        totalRiders,
        onlineRiders,
        occupancyRate,
        avgRevenuePerRider,
      },
    };
  }

  // ============================================================
  // ANALYTICS REVENUE
  // ============================================================

  async getRevenue(period: '7d' | '30d' | 'year') {
    const now = new Date();
    let periodStart: Date;
    let prevPeriodStart: Date;
    let prevPeriodEnd: Date;

    if (period === '7d') {
      periodStart = new Date(now);
      periodStart.setDate(periodStart.getDate() - 7);
      prevPeriodEnd = new Date(periodStart);
      prevPeriodStart = new Date(prevPeriodEnd);
      prevPeriodStart.setDate(prevPeriodStart.getDate() - 7);
    } else if (period === '30d') {
      periodStart = new Date(now);
      periodStart.setDate(periodStart.getDate() - 30);
      prevPeriodEnd = new Date(periodStart);
      prevPeriodStart = new Date(prevPeriodEnd);
      prevPeriodStart.setDate(prevPeriodStart.getDate() - 30);
    } else {
      periodStart = new Date(now.getFullYear(), 0, 1);
      prevPeriodStart = new Date(now.getFullYear() - 1, 0, 1);
      prevPeriodEnd = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59);
    }

    const COMMISSION_RATE = 0.15;

    const [deliveredOrders, prevDeliveredOrders, totalOrdersPeriod, paymentMethods, topCooks] =
      await Promise.all([
        this.prisma.order.findMany({
          where: { status: OrderStatus.DELIVERED, createdAt: { gte: periodStart } },
          select: { totalXaf: true, createdAt: true },
        }),
        this.prisma.order.findMany({
          where: {
            status: OrderStatus.DELIVERED,
            createdAt: { gte: prevPeriodStart, lte: prevPeriodEnd },
          },
          select: { totalXaf: true },
        }),
        this.prisma.order.count({ where: { createdAt: { gte: periodStart } } }),
        this.prisma.payment.groupBy({
          by: ['method'],
          where: { status: 'SUCCESS', createdAt: { gte: periodStart } },
          _count: { id: true },
          _sum: { amountXaf: true },
        }),
        this.prisma.order.groupBy({
          by: ['cookId'],
          where: { status: OrderStatus.DELIVERED, createdAt: { gte: periodStart } },
          _count: { id: true },
          _sum: { totalXaf: true },
          orderBy: { _sum: { totalXaf: 'desc' } },
          take: 5,
        }),
      ]);

    const totalRevenueXaf = deliveredOrders.reduce((s, o) => s + o.totalXaf, 0);
    const prevRevenue = prevDeliveredOrders.reduce((s, o) => s + o.totalXaf, 0);
    const totalTransactions = deliveredOrders.length;
    const conversionRate =
      totalOrdersPeriod > 0
        ? Math.round((totalTransactions / totalOrdersPeriod) * 10000) / 100
        : 0;
    const avgBasketXaf = totalTransactions > 0 ? Math.round(totalRevenueXaf / totalTransactions) : 0;
    const revenueTrend =
      prevRevenue > 0
        ? Math.round(((totalRevenueXaf - prevRevenue) / prevRevenue) * 10000) / 100
        : 0;

    // Weekly revenue breakdown
    const weeklyMap = new Map<string, { grossXaf: number }>();
    for (const order of deliveredOrders) {
      const d = new Date(order.createdAt);
      const weekStart = new Date(d);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      const key = `${weekStart.getFullYear()}-W${String(Math.ceil((weekStart.getDate()) / 7 + 1)).padStart(2, '0')}`;
      const label = `${String(weekStart.getDate()).padStart(2, '0')}/${String(weekStart.getMonth() + 1).padStart(2, '0')}`;
      const fullKey = label;
      if (!weeklyMap.has(fullKey)) {
        weeklyMap.set(fullKey, { grossXaf: 0 });
      }
      weeklyMap.get(fullKey)!.grossXaf += order.totalXaf;
    }
    const weeklyRevenue = Array.from(weeklyMap.entries()).map(([week, data]) => ({
      week,
      grossXaf: data.grossXaf,
      commissionXaf: Math.round(data.grossXaf * COMMISSION_RATE),
    }));

    // Payment breakdown
    const totalPayCount = paymentMethods.reduce((s, e) => s + e._count.id, 0);
    const paymentBreakdown = paymentMethods.map((e) => ({
      method: e.method,
      count: e._count.id,
      percentage: totalPayCount > 0 ? Math.round((e._count.id / totalPayCount) * 10000) / 100 : 0,
      totalXaf: e._sum.amountXaf ?? 0,
    }));

    // Top restaurants
    const cookUserIds = topCooks.map((c) => c.cookId);
    const cookProfiles = await this.prisma.cookProfile.findMany({
      where: { userId: { in: cookUserIds } },
      select: { userId: true, displayName: true, quarter: { select: { name: true } } },
    });
    const profileMap = new Map(cookProfiles.map((p) => [p.userId, p]));

    const topRestaurants = topCooks.map((c) => {
      const profile = profileMap.get(c.cookId);
      return {
        cookId: c.cookId,
        displayName: profile?.displayName ?? 'Inconnu',
        quarterName: profile?.quarter?.name ?? '',
        orders: c._count.id,
        revenueXaf: c._sum.totalXaf ?? 0,
        commissionXaf: Math.round((c._sum.totalXaf ?? 0) * COMMISSION_RATE),
      };
    });

    return {
      stats: {
        totalRevenueXaf,
        netPlatformXaf: Math.round(totalRevenueXaf * COMMISSION_RATE),
        totalTransactions,
        conversionRate,
        avgBasketXaf,
        revenueTrend,
      },
      weeklyRevenue,
      paymentBreakdown,
      topRestaurants,
    };
  }

  // ============================================================
  // SETTINGS
  // ============================================================

  getSettings() {
    const apiKey = this.config.get<string>('API_KEY', '');
    const masked = apiKey
      ? `${apiKey.slice(0, 3)}****...****${apiKey.slice(-4)}`
      : 'sk_****...****';

    return {
      general: {
        language: 'fr',
        timezone: 'Africa/Douala',
        currency: 'FCFA',
      },
      payment: {
        cashOnDelivery: true,
        platformCommission: parseInt(this.config.get('PLATFORM_COMMISSION_PERCENT', '15'), 10),
        minimumOrderXaf: 2500,
      },
      logistics: {
        maxDeliveryRadiusKm: parseInt(this.config.get('MAX_DELIVERY_RADIUS_KM', '10'), 10),
        defaultDeliveryFeeXaf: 800,
        enforceOpeningHours: false,
      },
      security: {
        mfaEnabled: false,
        apiKeyMasked: masked,
      },
    };
  }
}
