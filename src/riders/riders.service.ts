import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { DeliveryStatus, OrderStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { QueryEarningsDto } from './dto/query-earnings.dto';
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
        data: { riderId: riderUserId, status: OrderStatus.PICKED_UP },
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

    // Notifier le client que son livreur a accepté
    this.eventsService.notifyClient(order.clientId, 'order:status', {
      orderId,
      status: OrderStatus.PICKED_UP,
      riderId: riderUserId,
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

    if (newStatus === DeliveryStatus.DELIVERED) {
      updateData.deliveredAt = new Date();
      const riderEarningXaf = Math.round(delivery.order.deliveryFeeXaf * RIDER_COMMISSION);
      updateData.riderEarningXaf = riderEarningXaf;

      // Mettre à jour la commande et créer le gain rider
      await Promise.all([
        this.prisma.order.update({
          where: { id: delivery.orderId },
          data: { status: OrderStatus.DELIVERED },
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
}
