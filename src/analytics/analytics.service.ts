import { Injectable } from '@nestjs/common';
import { OrderStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { paginatedResult, paginationParams } from '../common/pagination.helper';
import { QueryAdminUsersDto, QueryAdminOrdersDto } from './dto/query-admin.dto';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboard() {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [
      totalOrders,
      totalUsers,
      totalCooks,
      totalRiders,
      ordersToday,
      deliveredToday,
    ] = await Promise.all([
      this.prisma.order.count(),
      this.prisma.user.count(),
      this.prisma.cookProfile.count({ where: { isActive: true } }),
      this.prisma.riderProfile.count({ where: { isVerified: true } }),
      this.prisma.order.count({ where: { createdAt: { gte: todayStart } } }),
      this.prisma.order.findMany({
        where: { status: OrderStatus.DELIVERED, createdAt: { gte: todayStart } },
        select: { totalXaf: true },
      }),
    ]);

    const revenueToday = deliveredToday.reduce((s, o) => s + o.totalXaf, 0);

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

    const totalRevenue = await this.prisma.order.findMany({
      where: { status: OrderStatus.DELIVERED },
      select: { totalXaf: true },
    });

    return {
      totalOrders,
      totalRevenue: totalRevenue.reduce((s, o) => s + o.totalXaf, 0),
      totalUsers,
      totalCooks,
      totalRiders,
      ordersToday,
      revenueToday,
      avgRating,
    };
  }

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

    const [total, data] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        include: { quarter: { select: { name: true, city: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
    ]);

    return paginatedResult(data, total, page, limit);
  }

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
}
