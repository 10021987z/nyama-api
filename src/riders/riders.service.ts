import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { DeliveryStatus, OrderStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { QueryEarningsDto } from './dto/query-earnings.dto';
import { SendOrderMessageDto } from './dto/send-order-message.dto';
import { UpdateRiderStatusDto } from './dto/update-rider-status.dto';
import { EventsService } from '../events/events.service';

// Libellés FR côté client pour chaque étape de livraison
const DELIVERY_STATUS_FR: Record<DeliveryStatus, string> = {
  [DeliveryStatus.ASSIGNED]: 'Livreur assigné',
  [DeliveryStatus.ARRIVED_RESTAURANT]: 'Livreur arrivé au restaurant',
  [DeliveryStatus.PICKED_UP]: 'Commande récupérée, en route',
  [DeliveryStatus.ARRIVED_CLIENT]: 'Livreur arrivé à destination',
  [DeliveryStatus.DELIVERED]: 'Livraison terminée',
};

// Transitions valides pour le livreur
const DELIVERY_TRANSITIONS: Record<DeliveryStatus, DeliveryStatus | null> = {
  [DeliveryStatus.ASSIGNED]: DeliveryStatus.ARRIVED_RESTAURANT,
  [DeliveryStatus.ARRIVED_RESTAURANT]: DeliveryStatus.PICKED_UP,
  [DeliveryStatus.PICKED_UP]: DeliveryStatus.ARRIVED_CLIENT,
  [DeliveryStatus.ARRIVED_CLIENT]: DeliveryStatus.DELIVERED,
  [DeliveryStatus.DELIVERED]: null,
};

const RIDER_COMMISSION = 0.8; // 80% des frais de livraison

@Injectable()
export class RidersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventsService: EventsService,
  ) {}

  private async getRiderProfile(riderUserId: string) {
    const profile = await this.prisma.riderProfile.findUnique({
      where: { userId: riderUserId },
    });
    if (!profile) throw new NotFoundException('Profil livreur introuvable');
    return profile;
  }

  async getAvailableOrders() {
    // TODO: filtrer par rider.online = true et afficher uniquement commandes dans un rayon de 5km
    return this.prisma.order.findMany({
      where: { status: OrderStatus.READY, riderId: null },
      include: {
        cook: { select: { id: true, name: true } },
        items: { select: { quantity: true, menuItem: { select: { name: true } } } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Met à jour le statut en ligne / position GPS d'un livreur.
   * Persiste dans RiderProfile (isOnline, lastSeenAt, lastLocationLat, lastLocationLng).
   */
  async updateRiderStatus(riderUserId: string, dto: UpdateRiderStatusDto) {
    const profile = await this.getRiderProfile(riderUserId);

    const data: Prisma.RiderProfileUpdateInput = {
      isOnline: dto.online,
      lastSeenAt: new Date(),
    };
    if (typeof dto.locationLat === 'number') {
      data.lastLocationLat = dto.locationLat;
    }
    if (typeof dto.locationLng === 'number') {
      data.lastLocationLng = dto.locationLng;
    }

    const updated = await this.prisma.riderProfile.update({
      where: { id: profile.id },
      data,
      select: {
        id: true,
        userId: true,
        isOnline: true,
        lastSeenAt: true,
        lastLocationLat: true,
        lastLocationLng: true,
      },
    });

    return updated;
  }

  async acceptOrder(orderId: string, riderUserId: string) {
    const riderProfile = await this.getRiderProfile(riderUserId);

    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Commande introuvable');
    if (order.status !== OrderStatus.READY) {
      throw new BadRequestException('Cette commande n\'est pas encore prête');
    }
    if (order.riderId !== null) {
      throw new BadRequestException('Cette commande a déjà un livreur');
    }

    // Mettre à jour la commande et créer la livraison
    const [updatedOrder, delivery] = await Promise.all([
      this.prisma.order.update({
        where: { id: orderId },
        data: {
          riderId: riderUserId,
          status: OrderStatus.ASSIGNED,
          assignedAt: new Date(),
        },
        include: {
          items: { include: { menuItem: { select: { name: true } } } },
          cook: { select: { id: true, name: true } },
        },
      }),
      this.prisma.delivery.create({
        data: {
          orderId,
          riderId: riderProfile.id,
          status: DeliveryStatus.ASSIGNED,
          dropoffLat: order.deliveryLat,
          dropoffLng: order.deliveryLng,
        },
      }),
    ]);

    // Récupère les infos publiques du livreur pour enrichir les payloads
    const riderUser = await this.prisma.user.findUnique({
      where: { id: riderUserId },
      select: {
        id: true,
        name: true,
        phone: true,
        avatarUrl: true,
        riderProfile: {
          select: { vehicleType: true, plateNumber: true },
        },
      },
    });

    const riderPayload = {
      id: riderUserId,
      name: riderUser?.name ?? null,
      phone: riderUser?.phone ?? null,
      photo: riderUser?.avatarUrl ?? null,
      vehicleType: riderUser?.riderProfile?.vehicleType ?? null,
      plateNumber: riderUser?.riderProfile?.plateNumber ?? null,
    };

    // 1) order:status → room commande + room cuisinière
    const orderStatusPayload = {
      orderId,
      status: OrderStatus.ASSIGNED,
      label: 'En livraison',
    };
    this.eventsService.emitToOrderRoom(orderId, 'order:status', orderStatusPayload);
    this.eventsService.notifyCook(order.cookId, 'order:status', orderStatusPayload);
    this.eventsService.notifyClient(order.clientId, 'order:status', {
      ...orderStatusPayload,
      riderId: riderUserId,
      rider: riderPayload,
    });

    // 2) order:assigned → cuisinière, avec infos livreur complètes
    this.eventsService.notifyCook(order.cookId, 'order:assigned', {
      orderId,
      rider: riderPayload,
    });

    // 3) delivery:created → room personnelle du livreur (pour basculer en course active)
    this.eventsService.notifyRider(riderUserId, 'delivery:created', {
      deliveryId: delivery.id,
      orderId,
      status: DeliveryStatus.ASSIGNED,
      dropoffLat: delivery.dropoffLat,
      dropoffLng: delivery.dropoffLng,
      assignedAt: delivery.assignedAt,
      order: {
        id: updatedOrder.id,
        status: updatedOrder.status,
        deliveryAddress: updatedOrder.deliveryAddress,
        deliveryLat: updatedOrder.deliveryLat,
        deliveryLng: updatedOrder.deliveryLng,
        totalXaf: updatedOrder.totalXaf,
        deliveryFeeXaf: updatedOrder.deliveryFeeXaf,
        cook: updatedOrder.cook,
      },
    });

    return updatedOrder;
  }

  async updateDeliveryStatus(
    deliveryId: string,
    riderUserId: string,
    newStatus: DeliveryStatus,
  ) {
    const riderProfile = await this.getRiderProfile(riderUserId);

    const delivery = await this.prisma.delivery.findUnique({
      where: { id: deliveryId },
      include: { order: true },
    });
    if (!delivery) throw new NotFoundException('Livraison introuvable');
    if (delivery.riderId !== riderProfile.id)
      throw new ForbiddenException('Cette livraison ne vous est pas assignée');

    const allowedNext = DELIVERY_TRANSITIONS[delivery.status];
    if (allowedNext !== newStatus) {
      throw new BadRequestException(
        `Transition invalide : ${delivery.status} → ${newStatus}`,
      );
    }

    const updateData: Prisma.DeliveryUpdateInput = { status: newStatus };
    if (newStatus === DeliveryStatus.PICKED_UP) {
      updateData.pickedUpAt = new Date();
    }

    if (newStatus === DeliveryStatus.PICKED_UP) {
      await this.prisma.order.update({
        where: { id: delivery.orderId },
        data: { status: OrderStatus.PICKED_UP, pickedUpAt: new Date() },
      });
    }

    if (newStatus === DeliveryStatus.DELIVERED) {
      updateData.deliveredAt = new Date();
      const riderEarningXaf = Math.round(delivery.order.deliveryFeeXaf * RIDER_COMMISSION);
      updateData.riderEarningXaf = riderEarningXaf;

      // Mettre à jour la commande et créer le gain rider
      await Promise.all([
        this.prisma.order.update({
          where: { id: delivery.orderId },
          data: { status: OrderStatus.DELIVERED, deliveredAt: new Date() },
        }),
        this.prisma.riderEarning.create({
          data: {
            riderId: riderProfile.id,
            deliveryId,
            grossXaf: delivery.order.deliveryFeeXaf,
            commissionXaf: delivery.order.deliveryFeeXaf - riderEarningXaf,
            netXaf: riderEarningXaf,
          },
        }),
        this.prisma.riderProfile.update({
          where: { id: riderProfile.id },
          data: { totalTrips: { increment: 1 } },
        }),
      ]);
    }

    const result = await this.prisma.delivery.update({
      where: { id: deliveryId },
      data: updateData,
    });

    // Infos livreur pour enrichir les payloads
    const riderUser = await this.prisma.user.findUnique({
      where: { id: riderUserId },
      select: {
        id: true,
        name: true,
        phone: true,
        avatarUrl: true,
        riderProfile: {
          select: { vehicleType: true, plateNumber: true },
        },
      },
    });
    const riderPayload = {
      id: riderUserId,
      name: riderUser?.name ?? null,
      phone: riderUser?.phone ?? null,
      photo: riderUser?.avatarUrl ?? null,
      vehicleType: riderUser?.riderProfile?.vehicleType ?? null,
      plateNumber: riderUser?.riderProfile?.plateNumber ?? null,
    };

    const deliveryPayload = {
      deliveryId,
      orderId: delivery.orderId,
      status: newStatus,
      rider: riderPayload,
    };

    // delivery:status → cuisinière, client, livreur
    this.eventsService.notifyCook(delivery.order.cookId, 'delivery:status', deliveryPayload);
    this.eventsService.notifyClient(delivery.order.clientId, 'delivery:status', deliveryPayload);
    this.eventsService.notifyRider(riderUserId, 'delivery:status', deliveryPayload);

    // Mapping vers order:status global avec libellé FR
    const orderStatusForClient: OrderStatus =
      newStatus === DeliveryStatus.DELIVERED
        ? OrderStatus.DELIVERED
        : newStatus === DeliveryStatus.PICKED_UP ||
          newStatus === DeliveryStatus.ARRIVED_CLIENT
          ? OrderStatus.PICKED_UP
          : OrderStatus.ASSIGNED;

    const orderStatusPayload = {
      orderId: delivery.orderId,
      status: orderStatusForClient,
      deliveryStatus: newStatus,
      label: DELIVERY_STATUS_FR[newStatus],
      rider: riderPayload,
    };

    this.eventsService.emitToOrderRoom(delivery.orderId, 'order:status', orderStatusPayload);
    this.eventsService.notifyClient(delivery.order.clientId, 'order:status', orderStatusPayload);
    this.eventsService.notifyCook(delivery.order.cookId, 'order:status', orderStatusPayload);

    return result;
  }

  async getEarnings(riderUserId: string, dto: QueryEarningsDto) {
    const riderProfile = await this.getRiderProfile(riderUserId);
    const period = dto.period ?? 'today';

    const now = new Date();
    const from = new Date();

    if (period === 'today') {
      from.setHours(0, 0, 0, 0);
    } else if (period === 'week') {
      from.setDate(now.getDate() - 7);
    } else {
      from.setMonth(now.getMonth() - 1);
    }

    const earnings = await this.prisma.riderEarning.findMany({
      where: {
        riderId: riderProfile.id,
        createdAt: { gte: from },
      },
      include: { delivery: { select: { deliveredAt: true } } },
      orderBy: { createdAt: 'desc' },
    });

    const total = earnings.reduce((sum, e) => sum + e.netXaf, 0);
    const count = earnings.length;

    return {
      total,
      count,
      avgPerDelivery: count > 0 ? Math.round(total / count) : 0,
      period,
      breakdown: earnings.map((e) => ({
        date: e.createdAt,
        netXaf: e.netXaf,
        deliveredAt: e.delivery.deliveredAt,
      })),
    };
  }

  async getProfile(riderUserId: string) {
    const profile = await this.prisma.riderProfile.findUnique({
      where: { userId: riderUserId },
      include: { user: { select: { name: true, phone: true } } },
    });
    if (!profile) throw new NotFoundException('Profil livreur introuvable');
    return profile;
  }

  // ─── CHAT RIDER ↔ COOK ───────────────────────────────────

  /** Vérifie que le livreur est assigné à la commande. */
  private async assertRiderAssignedToOrder(orderId: string, riderUserId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, riderId: true },
    });
    if (!order) throw new NotFoundException('Commande introuvable');
    if (order.riderId !== riderUserId)
      throw new ForbiddenException('Cette commande ne vous est pas assignée');
    return order;
  }

  async listOrderMessagesAsRider(orderId: string, riderUserId: string) {
    await this.assertRiderAssignedToOrder(orderId, riderUserId);
    return this.prisma.orderMessage.findMany({
      where: { orderId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        senderId: true,
        senderRole: true,
        text: true,
        createdAt: true,
      },
    });
  }

  async postOrderMessageAsRider(
    orderId: string,
    riderUserId: string,
    dto: SendOrderMessageDto,
  ) {
    await this.assertRiderAssignedToOrder(orderId, riderUserId);
    const message = await this.prisma.orderMessage.create({
      data: {
        orderId,
        senderId: riderUserId,
        senderRole: 'RIDER',
        text: dto.text,
      },
      select: {
        id: true,
        senderId: true,
        senderRole: true,
        text: true,
        createdAt: true,
      },
    });
    this.eventsService.emitToOrderRoom(orderId, 'message:new', { ...message, orderId });
    return message;
  }
}
