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
import { EventsService } from '../events/events.service';

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
    return this.prisma.order.findMany({
      where: { status: OrderStatus.READY, riderId: null },
      include: {
        cook: { select: { id: true, name: true } },
        items: { select: { quantity: true, menuItem: { select: { name: true } } } },
      },
      orderBy: { createdAt: 'asc' },
    });
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
    const [updatedOrder] = await Promise.all([
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

    // Notifier le client que son livreur est assigné
    this.eventsService.notifyClient(order.clientId, 'order:status', {
      orderId,
      status: OrderStatus.ASSIGNED,
      riderId: riderUserId,
    });
    this.eventsService.notifyCook(order.cookId, 'order:status', {
      orderId,
      status: OrderStatus.ASSIGNED,
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

    // Notifier le client de la progression de la livraison
    this.eventsService.notifyClient(delivery.order.clientId, 'order:status', {
      orderId: delivery.orderId,
      status: newStatus === DeliveryStatus.DELIVERED ? OrderStatus.DELIVERED : OrderStatus.PICKED_UP,
      deliveryStatus: newStatus,
    });

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
