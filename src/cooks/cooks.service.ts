import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { OrderStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { paginatedResult, paginationParams } from '../common/pagination.helper';
import { QueryCooksDto } from './dto/query-cooks.dto';
import { QueryCookOrdersDto } from './dto/query-cook-orders.dto';
import { CreateMenuItemDto } from './dto/create-menu-item.dto';
import { UpdateMenuItemDto } from './dto/update-menu-item.dto';
import { EventsService } from '../events/events.service';

// Transitions valides pour une cuisinière
const COOK_TRANSITIONS: Partial<Record<OrderStatus, OrderStatus>> = {
  [OrderStatus.PENDING]: OrderStatus.CONFIRMED,
  [OrderStatus.CONFIRMED]: OrderStatus.PREPARING,
  [OrderStatus.PREPARING]: OrderStatus.READY,
};

const COOK_CANCEL_ALLOWED: OrderStatus[] = [OrderStatus.PENDING, OrderStatus.CONFIRMED];

const ORDER_INCLUDE = {
  items: {
    include: { menuItem: { select: { name: true, priceXaf: true } } },
  },
  client: { select: { id: true, name: true, phone: true } },
  rider: { select: { id: true, name: true } },
} satisfies Prisma.OrderInclude;

@Injectable()
export class CooksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventsService: EventsService,
  ) {}

  // ─── PUBLIC ──────────────────────────────────────────────

  async findAll(dto: QueryCooksDto) {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    const { skip, take } = paginationParams(page, limit);

    const where: Prisma.CookProfileWhereInput = {
      isActive: true,
      ...(dto.quarter_id ? { quarterId: dto.quarter_id } : {}),
      ...(dto.city ? { quarter: { city: dto.city } } : {}),
      ...(dto.search ? { displayName: { contains: dto.search } } : {}),
    };

    const sortMap: Record<string, Prisma.CookProfileOrderByWithRelationInput> = {
      rating: { avgRating: 'desc' },
      totalOrders: { totalOrders: 'desc' },
      displayName: { displayName: 'asc' },
    };
    const orderBy = sortMap[dto.sort ?? 'rating'];

    const [total, data] = await Promise.all([
      this.prisma.cookProfile.count({ where }),
      this.prisma.cookProfile.findMany({
        where,
        include: { quarter: { select: { name: true, city: true } } },
        orderBy,
        skip,
        take,
      }),
    ]);

    return paginatedResult(data, total, page, limit);
  }

  async findById(id: string) {
    const cook = await this.prisma.cookProfile.findUnique({
      where: { id },
      include: {
        quarter: { select: { name: true, city: true } },
        menuItems: { where: { isAvailable: true }, orderBy: { category: 'asc' } },
      },
    });
    if (!cook) throw new NotFoundException('Cuisinière introuvable');
    return cook;
  }

  // ─── COOK-SPECIFIC (authentifié) ─────────────────────────

  private async getCookProfile(cookUserId: string) {
    const profile = await this.prisma.cookProfile.findUnique({
      where: { userId: cookUserId },
    });
    if (!profile) throw new NotFoundException('Profil cuisinière introuvable');
    return profile;
  }

  async getCookOrders(cookUserId: string, dto: QueryCookOrdersDto) {
    const where: Prisma.OrderWhereInput = {
      cookId: cookUserId,
      ...(dto.status ? { status: dto.status } : {}),
      ...(dto.date
        ? {
            createdAt: {
              gte: new Date(`${dto.date}T00:00:00Z`),
              lte: new Date(`${dto.date}T23:59:59Z`),
            },
          }
        : {}),
    };

    return this.prisma.order.findMany({
      where,
      include: ORDER_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  }

  async transitionOrder(
    orderId: string,
    cookUserId: string,
    targetStatus: OrderStatus,
  ) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Commande introuvable');
    if (order.cookId !== cookUserId)
      throw new ForbiddenException('Cette commande ne vous appartient pas');

    const allowed = COOK_TRANSITIONS[order.status];
    if (allowed !== targetStatus) {
      throw new BadRequestException(
        `Transition invalide : ${order.status} → ${targetStatus}`,
      );
    }

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        status: targetStatus,
        ...(targetStatus === OrderStatus.CONFIRMED || targetStatus === OrderStatus.PREPARING
          ? { acceptedAt: new Date() }
          : {}),
        ...(targetStatus === OrderStatus.READY ? { readyAt: new Date() } : {}),
      },
      include: ORDER_INCLUDE,
    });

    // Notifier le client du changement de statut
    this.eventsService.notifyClient(order.clientId, 'order:status', {
      orderId,
      status: targetStatus,
    });

    // Si READY → notifier les livreurs disponibles
    if (targetStatus === OrderStatus.READY) {
      const cookProfile = await this.prisma.cookProfile.findUnique({
        where: { userId: cookUserId },
        select: { quarterId: true },
      });
      this.eventsService.notifyAvailableRiders(
        cookProfile?.quarterId ?? null,
        'order:ready',
        { orderId, totalXaf: order.totalXaf, deliveryFeeXaf: order.deliveryFeeXaf },
      );
    }

    return updated;
  }

  async rejectOrder(orderId: string, cookUserId: string, reason: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Commande introuvable');
    if (order.cookId !== cookUserId)
      throw new ForbiddenException('Cette commande ne vous appartient pas');
    if (!COOK_CANCEL_ALLOWED.includes(order.status))
      throw new BadRequestException('Cette commande ne peut plus être annulée');

    return this.prisma.order.update({
      where: { id: orderId },
      data: {
        status: OrderStatus.CANCELLED,
        cancelReason: reason,
        cancelledAt: new Date(),
      },
      include: ORDER_INCLUDE,
    });
  }

  async getDashboard(cookUserId: string) {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const profile = await this.getCookProfile(cookUserId);

    const [ordersToday, revenueAggregate, pendingOrders, preparingOrders] =
      await Promise.all([
        this.prisma.order.count({
          where: {
            cookId: cookUserId,
            status: OrderStatus.DELIVERED,
            createdAt: { gte: todayStart },
          },
        }),
        this.prisma.order.findMany({
          where: {
            cookId: cookUserId,
            status: OrderStatus.DELIVERED,
            createdAt: { gte: todayStart },
          },
          select: { totalXaf: true },
        }),
        this.prisma.order.findMany({
          where: { cookId: cookUserId, status: OrderStatus.PENDING },
          include: ORDER_INCLUDE,
          orderBy: { createdAt: 'asc' },
        }),
        this.prisma.order.findMany({
          where: { cookId: cookUserId, status: OrderStatus.PREPARING },
          include: ORDER_INCLUDE,
          orderBy: { createdAt: 'asc' },
        }),
      ]);

    const revenueToday = revenueAggregate.reduce(
      (sum, o) => sum + o.totalXaf,
      0,
    );

    return {
      ordersToday,
      revenueToday,
      pendingOrders,
      preparingOrders,
      avgRating: profile.avgRating,
      totalOrders: profile.totalOrders,
    };
  }

  // ─── MENU MANAGEMENT ─────────────────────────────────────

  async getCookMenu(cookUserId: string) {
    const profile = await this.getCookProfile(cookUserId);
    return this.prisma.menuItem.findMany({
      where: { cookId: profile.id },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });
  }

  async createMenuItem(cookUserId: string, dto: CreateMenuItemDto) {
    const profile = await this.getCookProfile(cookUserId);
    return this.prisma.menuItem.create({
      data: { ...dto, cookId: profile.id },
    });
  }

  async updateMenuItem(
    itemId: string,
    cookUserId: string,
    dto: UpdateMenuItemDto,
  ) {
    const profile = await this.getCookProfile(cookUserId);
    const item = await this.prisma.menuItem.findUnique({ where: { id: itemId } });
    if (!item) throw new NotFoundException('Plat introuvable');
    if (item.cookId !== profile.id)
      throw new ForbiddenException('Ce plat ne vous appartient pas');

    return this.prisma.menuItem.update({ where: { id: itemId }, data: dto });
  }

  async softDeleteMenuItem(itemId: string, cookUserId: string) {
    const profile = await this.getCookProfile(cookUserId);
    const item = await this.prisma.menuItem.findUnique({ where: { id: itemId } });
    if (!item) throw new NotFoundException('Plat introuvable');
    if (item.cookId !== profile.id)
      throw new ForbiddenException('Ce plat ne vous appartient pas');

    return this.prisma.menuItem.update({
      where: { id: itemId },
      data: { isAvailable: false },
    });
  }
}
