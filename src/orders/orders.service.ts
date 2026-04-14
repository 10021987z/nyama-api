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
            ? dto.status === OrderStatus.READY
              ? { riderId: null, status: OrderStatus.READY }
              : { riderId: userId }
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

  async adminUpdateStatus(
    orderId: string,
    status: OrderStatus,
    cancelReason?: string,
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });
    if (!order) throw new NotFoundException('Commande introuvable');

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        status,
        ...(status === OrderStatus.CANCELLED
          ? { cancelReason: cancelReason ?? 'Annulée par admin', cancelledAt: new Date() }
          : {}),
        ...(status === OrderStatus.PREPARING ? { acceptedAt: new Date() } : {}),
        ...(status === OrderStatus.READY ? { readyAt: new Date() } : {}),
        ...(status === OrderStatus.ASSIGNED ? { assignedAt: new Date() } : {}),
        ...(status === OrderStatus.PICKED_UP ? { pickedUpAt: new Date() } : {}),
        ...(status === OrderStatus.DELIVERED ? { deliveredAt: new Date() } : {}),
      },
      include: ORDER_DETAIL_INCLUDE,
    });
    // Let realtime listeners know
    this.eventsService.notifyClient(order.clientId, 'order:status', {
      orderId,
      status,
    });
    this.eventsService.notifyCook(order.cookId, 'order:status', {
      orderId,
      status,
    });
    return updated;
  }

  async cookAccept(orderId: string, cookUserId: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Commande introuvable');
    if (order.cookId !== cookUserId)
      throw new ForbiddenException('Cette commande ne vous appartient pas');
    if (order.status !== OrderStatus.PENDING)
      throw new BadRequestException('Cette commande ne peut plus être acceptée');

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: { status: OrderStatus.PREPARING, acceptedAt: new Date() },
      include: ORDER_DETAIL_INCLUDE,
    });
    this.eventsService.notifyClient(order.clientId, 'order:status', {
      orderId,
      status: OrderStatus.PREPARING,
    });
    return updated;
  }

  async cookReady(orderId: string, cookUserId: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Commande introuvable');
    if (order.cookId !== cookUserId)
      throw new ForbiddenException('Cette commande ne vous appartient pas');
    if (order.status !== OrderStatus.PREPARING)
      throw new BadRequestException('La commande doit être en préparation');

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: { status: OrderStatus.READY, readyAt: new Date() },
      include: ORDER_DETAIL_INCLUDE,
    });
    this.eventsService.notifyClient(order.clientId, 'order:status', {
      orderId,
      status: OrderStatus.READY,
    });
    this.eventsService.notifyAvailableRiders(null, 'order:available', {
      orderId,
      cookId: order.cookId,
      deliveryAddress: order.deliveryAddress,
    });
    return updated;
  }

  async assignRider(
    orderId: string,
    riderUserId: string,
    actorRole: UserRole,
    actorId: string,
  ) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Commande introuvable');
    if (order.status !== OrderStatus.READY)
      throw new BadRequestException('La commande n\'est pas disponible à l\'assignation');
    if (order.riderId)
      throw new BadRequestException('Un livreur est déjà assigné à cette commande');

    if (actorRole === UserRole.RIDER && actorId !== riderUserId)
      throw new ForbiddenException('Vous ne pouvez assigner que vous-même');

    const riderProfile = await this.prisma.riderProfile.findUnique({
      where: { userId: riderUserId },
    });
    if (!riderProfile) throw new NotFoundException('Livreur introuvable');

    const cookProfile = await this.prisma.cookProfile.findUnique({
      where: { userId: order.cookId },
    });

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        riderId: riderUserId,
        status: OrderStatus.ASSIGNED,
        assignedAt: new Date(),
        delivery: {
          create: {
            riderId: riderProfile.id,
            pickupLat: cookProfile?.locationLat,
            pickupLng: cookProfile?.locationLng,
            dropoffLat: order.deliveryLat,
            dropoffLng: order.deliveryLng,
          },
        },
      },
      include: ORDER_DETAIL_INCLUDE,
    });
    this.eventsService.notifyClient(order.clientId, 'order:status', {
      orderId,
      status: OrderStatus.ASSIGNED,
    });
    this.eventsService.notifyCook(order.cookId, 'order:status', {
      orderId,
      status: OrderStatus.ASSIGNED,
    });
    this.eventsService.notifyRider(riderUserId, 'order:assigned', { orderId });
    return updated;
  }

  async riderPickup(orderId: string, riderUserId: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Commande introuvable');
    if (order.riderId !== riderUserId)
      throw new ForbiddenException('Cette commande ne vous est pas assignée');
    if (order.status !== OrderStatus.ASSIGNED)
      throw new BadRequestException('La commande doit être assignée pour être récupérée');

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        status: OrderStatus.PICKED_UP,
        pickedUpAt: new Date(),
        delivery: { update: { status: 'PICKED_UP', pickedUpAt: new Date() } },
      },
      include: ORDER_DETAIL_INCLUDE,
    });
    this.eventsService.notifyClient(order.clientId, 'order:status', {
      orderId,
      status: OrderStatus.PICKED_UP,
    });
    this.eventsService.notifyCook(order.cookId, 'order:status', {
      orderId,
      status: OrderStatus.PICKED_UP,
    });
    return updated;
  }

  async riderDeliver(orderId: string, riderUserId: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Commande introuvable');
    if (order.riderId !== riderUserId)
      throw new ForbiddenException('Cette commande ne vous est pas assignée');
    if (order.status !== OrderStatus.PICKED_UP)
      throw new BadRequestException('La commande doit être récupérée pour être livrée');

    const now = new Date();
    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        status: OrderStatus.DELIVERED,
        deliveredAt: now,
        delivery: { update: { status: 'DELIVERED', deliveredAt: now } },
      },
      include: ORDER_DETAIL_INCLUDE,
    });
    this.eventsService.notifyClient(order.clientId, 'order:status', {
      orderId,
      status: OrderStatus.DELIVERED,
    });
    this.eventsService.notifyCook(order.cookId, 'order:status', {
      orderId,
      status: OrderStatus.DELIVERED,
    });
    return updated;
  }

  async clientCancel(orderId: string, clientId: string, reason?: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });
    if (!order) throw new NotFoundException('Commande introuvable');
    if (order.clientId !== clientId)
      throw new ForbiddenException('Cette commande ne vous appartient pas');
    if (
      order.status !== OrderStatus.PENDING &&
      order.status !== OrderStatus.CONFIRMED
    ) {
      throw new BadRequestException(
        'Cette commande ne peut plus être annulée',
      );
    }
    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        status: OrderStatus.CANCELLED,
        cancelReason: reason ?? 'Annulée par le client',
        cancelledAt: new Date(),
      },
      include: ORDER_DETAIL_INCLUDE,
    });
    this.eventsService.notifyCook(order.cookId, 'order:cancelled', {
      orderId,
    });
    return updated;
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
