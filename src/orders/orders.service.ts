import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { OrderStatus, PaymentStatus, Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { paginatedResult, paginationParams } from '../common/pagination.helper';
import { CreateOrderDto } from './dto/create-order.dto';
import { QueryOrdersDto } from './dto/query-orders.dto';
import { EventsService } from '../events/events.service';

const DELIVERY_FEE_XAF = 800; // MVP : frais fixes

const ORDER_DETAIL_INCLUDE = {
  items: {
    include: { menuItem: { select: { name: true, priceXaf: true, imageUrl: true } } },
  },
  cook: { select: { id: true, name: true } },
  rider: { select: { id: true, name: true } },
  payment: true,
  delivery: true,
  reviews: { select: { cookRating: true, riderRating: true, cookComment: true, riderComment: true } },
} satisfies Prisma.OrderInclude;

const ORDER_LIST_INCLUDE = {
  items: {
    include: { menuItem: { select: { name: true } } },
  },
  cook: { select: { id: true, name: true } },
  rider: { select: { id: true, name: true } },
} satisfies Prisma.OrderInclude;

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventsService: EventsService,
  ) {}

  async create(clientId: string, dto: CreateOrderDto) {
    // Vérifier que le cook existe et est actif
    const cookProfile = await this.prisma.cookProfile.findUnique({
      where: { userId: dto.cookId },
    });
    if (!cookProfile || !cookProfile.isActive) {
      throw new NotFoundException('Cuisinière introuvable ou inactive');
    }

    // Charger et valider tous les plats
    const menuItemIds = dto.items.map((i) => i.menuItemId);
    const menuItems = await this.prisma.menuItem.findMany({
      where: { id: { in: menuItemIds } },
    });

    if (menuItems.length !== menuItemIds.length) {
      throw new BadRequestException('Un ou plusieurs plats sont introuvables');
    }

    for (const mi of menuItems) {
      if (mi.cookId !== cookProfile.id) {
        throw new BadRequestException(
          `Le plat "${mi.name}" n'appartient pas à cette cuisinière`,
        );
      }
      if (!mi.isAvailable) {
        throw new BadRequestException(`Le plat "${mi.name}" n'est plus disponible`);
      }
    }

    // Calculer les montants
    const itemsMap = new Map(menuItems.map((m) => [m.id, m]));
    const orderItems = dto.items.map((i) => {
      const mi = itemsMap.get(i.menuItemId)!;
      return {
        menuItemId: i.menuItemId,
        quantity: i.quantity,
        unitPriceXaf: mi.priceXaf,
        subtotalXaf: mi.priceXaf * i.quantity,
      };
    });
    const totalXaf = orderItems.reduce((s, i) => s + i.subtotalXaf, 0);

    // Transaction atomique : Order + OrderItems + Payment
    const order = await this.prisma.order.create({
      data: {
        clientId,
        cookId: dto.cookId,
        totalXaf,
        deliveryFeeXaf: DELIVERY_FEE_XAF,
        paymentMethod: dto.paymentMethod,
        paymentStatus: PaymentStatus.PENDING,
        status: OrderStatus.PENDING,
        deliveryAddress: dto.deliveryAddress,
        deliveryLat: dto.deliveryLat,
        deliveryLng: dto.deliveryLng,
        landmark: dto.landmark,
        clientNote: dto.clientNote,
        items: { create: orderItems },
        payment: {
          create: {
            method: dto.paymentMethod,
            status: PaymentStatus.PENDING,
            amountXaf: totalXaf + DELIVERY_FEE_XAF,
          },
        },
      },
      include: ORDER_DETAIL_INCLUDE,
    });

    // WebSocket : notifier la cuisinière en temps réel
    this.eventsService.notifyCook(dto.cookId, 'order:new', {
      orderId: order.id,
      totalXaf: order.totalXaf,
      deliveryAddress: order.deliveryAddress,
      itemCount: order.items.length,
    });

    return order;
  }

  async findAll(
    userId: string,
    role: UserRole,
    dto: QueryOrdersDto,
  ) {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    const { skip, take } = paginationParams(page, limit);

    const roleFilter: Prisma.OrderWhereInput =
      role === UserRole.CLIENT
        ? { clientId: userId }
        : role === UserRole.COOK
          ? { cookId: userId }
          : role === UserRole.RIDER
            ? { riderId: userId }
            : {}; // ADMIN : tout

    const dateFilter: Prisma.OrderWhereInput =
      dto.from || dto.to
        ? {
            createdAt: {
              ...(dto.from ? { gte: new Date(dto.from) } : {}),
              ...(dto.to ? { lte: new Date(`${dto.to}T23:59:59Z`) } : {}),
            },
          }
        : {};

    const where: Prisma.OrderWhereInput = {
      ...roleFilter,
      ...dateFilter,
      ...(dto.status ? { status: dto.status } : {}),
    };

    const [total, data] = await Promise.all([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        include: ORDER_LIST_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
    ]);

    return paginatedResult(data, total, page, limit);
  }

  async findOne(orderId: string, userId: string, role: UserRole) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: ORDER_DETAIL_INCLUDE,
    });
    if (!order) throw new NotFoundException('Commande introuvable');

    const canAccess =
      role === UserRole.ADMIN ||
      order.clientId === userId ||
      order.cookId === userId ||
      order.riderId === userId;

    if (!canAccess) throw new ForbiddenException('Accès non autorisé');

    return order;
  }
}
