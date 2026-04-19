import {
  Injectable,
  Logger,
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
  private readonly logger = new Logger(RidersService.name);

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

    // 1) order:status → room commande + cuisinière + client + livreur
    const orderStatusPayload = {
      orderId,
      status: OrderStatus.ASSIGNED,
      label: 'En livraison',
    };
    this.logger.log(
      `📡 emit('order:status') → rooms: order-${orderId}, cook-${order.cookId}, client-${order.clientId}, rider-${riderUserId} | payload: status=${OrderStatus.ASSIGNED}`,
    );
    this.eventsService.emitToOrderRoom(orderId, 'order:status', orderStatusPayload);
    this.eventsService.notifyCook(order.cookId, 'order:status', orderStatusPayload);
    this.eventsService.notifyClient(order.clientId, 'order:status', {
      ...orderStatusPayload,
      riderId: riderUserId,
      rider: riderPayload,
    });
    this.eventsService.notifyRider(riderUserId, 'order:status', {
      ...orderStatusPayload,
      riderId: riderUserId,
    });

    // 2) order:assigned → cuisinière, client, livreur
    this.logger.log(
      `📡 emit('order:assigned') → rooms: cook-${order.cookId}, client-${order.clientId}, rider-${riderUserId} | payload: orderId=${orderId} riderId=${riderUserId}`,
    );
    this.eventsService.notifyCook(order.cookId, 'order:assigned', {
      orderId,
      rider: riderPayload,
    });
    this.eventsService.notifyClient(order.clientId, 'order:assigned', {
      orderId,
      riderId: riderUserId,
      rider: riderPayload,
    });
    this.eventsService.notifyRider(riderUserId, 'order:assigned', {
      orderId,
      rider: riderPayload,
    });

    // 3) delivery:created → room personnelle du livreur (pour basculer en course active)
    this.logger.log(
      `📡 emit('delivery:created') → rooms: rider-${riderUserId} | payload: deliveryId=${delivery.id} orderId=${orderId}`,
    );
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

    let result;
    if (newStatus === DeliveryStatus.DELIVERED) {
      const now = new Date();
      updateData.deliveredAt = now;
      const riderEarningXaf = Math.round(delivery.order.deliveryFeeXaf * RIDER_COMMISSION);
      updateData.riderEarningXaf = riderEarningXaf;

      // Transaction atomique : delivery + order + earning + trip counter
      const [, , updatedDelivery] = await this.prisma.$transaction([
        this.prisma.order.update({
          where: { id: delivery.orderId },
          data: { status: OrderStatus.DELIVERED, deliveredAt: now },
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
        this.prisma.delivery.update({
          where: { id: deliveryId },
          data: updateData,
        }),
        this.prisma.riderProfile.update({
          where: { id: riderProfile.id },
          data: { totalTrips: { increment: 1 } },
        }),
      ]);
      result = updatedDelivery;
    } else {
      result = await this.prisma.delivery.update({
        where: { id: deliveryId },
        data: updateData,
      });
    }

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

    // delivery:status → room commande + cuisinière + client + livreur
    this.logger.log(
      `📡 emit('delivery:status') → rooms: order-${delivery.orderId}, cook-${delivery.order.cookId}, client-${delivery.order.clientId}, rider-${riderUserId} | payload: deliveryStatus=${newStatus}`,
    );
    this.eventsService.emitToOrderRoom(delivery.orderId, 'delivery:status', deliveryPayload);
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

    this.logger.log(
      `📡 emit('order:status') → rooms: order-${delivery.orderId}, cook-${delivery.order.cookId}, client-${delivery.order.clientId}, rider-${riderUserId} | payload: status=${orderStatusForClient} deliveryStatus=${newStatus}`,
    );
    this.eventsService.emitToOrderRoom(delivery.orderId, 'order:status', orderStatusPayload);
    this.eventsService.notifyClient(delivery.order.clientId, 'order:status', orderStatusPayload);
    this.eventsService.notifyCook(delivery.order.cookId, 'order:status', orderStatusPayload);
    this.eventsService.notifyRider(riderUserId, 'order:status', orderStatusPayload);

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
    this.logger.log(
      `📡 emit('message:new') → rooms: order-${orderId} | payload: senderRole=RIDER`,
    );
    this.eventsService.emitToOrderRoom(orderId, 'message:new', { ...message, orderId });
    return message;
  }

  // ─── LIVE LOCATION ───────────────────────────────────────

  // Rate-limit mémoire : max 1 emit / 3 s par rider
  private lastLocationEmitAt = new Map<string, number>();
  private static readonly LOCATION_EMIT_MIN_INTERVAL_MS = 3000;

  async updateLocationLive(
    riderUserId: string,
    lat: number,
    lng: number,
    orderId?: string,
  ) {
    const profile = await this.getRiderProfile(riderUserId);

    // Persistance en DB (toujours)
    await this.prisma.riderProfile.update({
      where: { id: profile.id },
      data: {
        lastLocationLat: lat,
        lastLocationLng: lng,
        lastSeenAt: new Date(),
      },
    });

    // Rate-limit emit socket
    const now = Date.now();
    const lastAt = this.lastLocationEmitAt.get(riderUserId) ?? 0;
    if (now - lastAt < RidersService.LOCATION_EMIT_MIN_INTERVAL_MS) {
      return { ok: true, emitted: false };
    }
    this.lastLocationEmitAt.set(riderUserId, now);

    // Résout l'orderId actif si non fourni
    let targetOrder: { id: string; clientId: string } | null = null;
    if (orderId) {
      const ord = await this.prisma.order.findUnique({
        where: { id: orderId },
        select: { id: true, clientId: true, riderId: true },
      });
      if (ord && ord.riderId === riderUserId) {
        targetOrder = { id: ord.id, clientId: ord.clientId };
      }
    } else {
      const active = await this.prisma.order.findFirst({
        where: {
          riderId: riderUserId,
          status: {
            in: [OrderStatus.ASSIGNED, OrderStatus.PICKED_UP, OrderStatus.DELIVERING],
          },
        },
        select: { id: true, clientId: true },
      });
      if (active) targetOrder = active;
    }

    if (targetOrder) {
      await this.eventsService.updateRiderLocation(riderUserId, lat, lng);
    }

    return { ok: true, emitted: Boolean(targetOrder) };
  }

  // ─── PROFIL COMPLET ──────────────────────────────────────

  async getFullProfile(riderUserId: string) {
    const profile = await this.prisma.riderProfile.findUnique({
      where: { userId: riderUserId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
            avatarUrl: true,
            createdAt: true,
          },
        },
      },
    });
    if (!profile) throw new NotFoundException('Profil livreur introuvable');

    const reviewsCount = await this.prisma.review.count({
      where: {
        riderRating: { not: null },
        order: { riderId: riderUserId },
      },
    });

    const docStatus = (expiry: Date | null) => {
      if (!expiry) return 'MISSING';
      const now = Date.now();
      const diffDays = Math.round((expiry.getTime() - now) / (1000 * 60 * 60 * 24));
      if (diffDays < 0) return 'EXPIRED';
      if (diffDays <= 30) return 'EXPIRING_SOON';
      return 'VALID';
    };

    return {
      id: profile.id,
      userId: profile.userId,
      name: profile.user.name,
      phone: profile.user.phone,
      email: profile.user.email,
      avatarUrl: profile.user.avatarUrl,
      memberSince: profile.user.createdAt,
      isOnline: profile.isOnline,
      onlineSinceAt: profile.onlineSinceAt,
      lastSeenAt: profile.lastSeenAt,
      avgRating: profile.avgRating,
      reviewsCount,
      totalTrips: profile.totalTrips,
      isVerified: profile.isVerified,
      address: profile.address,
      vehicle: {
        type: profile.vehicleType,
        brand: profile.vehicleBrand,
        plate: profile.plateNumber,
        year: profile.vehicleYear,
        km: profile.vehicleKm,
      },
      documents: {
        license: {
          number: profile.licenseNumber,
          expiry: profile.licenseExpiry,
          url: profile.licenseUrl,
          status: docStatus(profile.licenseExpiry),
        },
        registration: {
          url: profile.registrationUrl,
          status: profile.registrationUrl ? 'VALID' : 'MISSING',
        },
        insurance: {
          number: profile.insuranceNumber,
          expiry: profile.insuranceExpiry,
          url: profile.insuranceUrl,
          status: docStatus(profile.insuranceExpiry),
        },
      },
      wallet: {
        momoPhone: profile.momoPhone,
        momoProvider: profile.momoProvider,
        iban: profile.iban,
      },
    };
  }

  async updateProfile(riderUserId: string, dto: Record<string, unknown>) {
    const profile = await this.getRiderProfile(riderUserId);
    const data: Prisma.RiderProfileUpdateInput = {};

    // Champs autorisés uniquement (pas de changement de nom/KYC)
    const stringFields = [
      'plateNumber',
      'vehicleBrand',
      'insuranceNumber',
      'licenseNumber',
      'iban',
      'momoPhone',
      'momoProvider',
      'address',
    ] as const;
    for (const k of stringFields) {
      if (typeof dto[k] === 'string') (data as any)[k] = dto[k];
    }
    const intFields = ['vehicleYear', 'vehicleKm'] as const;
    for (const k of intFields) {
      if (typeof dto[k] === 'number') (data as any)[k] = dto[k];
    }
    const dateFields = ['insuranceExpiry', 'licenseExpiry'] as const;
    for (const k of dateFields) {
      if (typeof dto[k] === 'string') (data as any)[k] = new Date(dto[k] as string);
    }

    await this.prisma.riderProfile.update({
      where: { id: profile.id },
      data,
    });
    return this.getFullProfile(riderUserId);
  }

  // ─── STATS FINANCIÈRES ───────────────────────────────────

  async getFinancialStats(riderUserId: string) {
    const profile = await this.getRiderProfile(riderUserId);

    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);

    const startOfWeek = new Date(now);
    startOfWeek.setDate(startOfWeek.getDate() - 7);
    startOfWeek.setHours(0, 0, 0, 0);

    const startOfPrevWeek = new Date(now);
    startOfPrevWeek.setDate(startOfPrevWeek.getDate() - 14);
    startOfPrevWeek.setHours(0, 0, 0, 0);

    const startOfMonth = new Date(now);
    startOfMonth.setDate(startOfMonth.getDate() - 30);
    startOfMonth.setHours(0, 0, 0, 0);

    const bucket = async (from: Date, to?: Date) => {
      const deliveries = await this.prisma.delivery.findMany({
        where: {
          riderId: profile.id,
          status: DeliveryStatus.DELIVERED,
          deliveredAt: to ? { gte: from, lt: to } : { gte: from },
        },
        select: {
          riderEarningXaf: true,
          distanceKm: true,
          assignedAt: true,
          deliveredAt: true,
        },
      });
      const earnings = deliveries.reduce((s, d) => s + (d.riderEarningXaf ?? 0), 0);
      const km = deliveries.reduce((s, d) => s + (d.distanceKm ?? 0), 0);
      const hoursOnline = deliveries.reduce((s, d) => {
        if (!d.assignedAt || !d.deliveredAt) return s;
        return s + (d.deliveredAt.getTime() - d.assignedAt.getTime()) / 3_600_000;
      }, 0);
      return {
        trips: deliveries.length,
        earningsXaf: earnings,
        distanceKm: Math.round(km * 10) / 10,
        hoursOnline: Math.round(hoursOnline * 10) / 10,
      };
    };

    const [today, week, prevWeek, month] = await Promise.all([
      bucket(startOfToday),
      bucket(startOfWeek),
      bucket(startOfPrevWeek, startOfWeek),
      bucket(startOfMonth),
    ]);

    const vsLastWeekPct =
      prevWeek.earningsXaf > 0
        ? Math.round(((week.earningsXaf - prevWeek.earningsXaf) / prevWeek.earningsXaf) * 100)
        : null;

    // Série 30 jours pour le graphique bar (earnings par jour)
    const daily = await this.prisma.delivery.findMany({
      where: {
        riderId: profile.id,
        status: DeliveryStatus.DELIVERED,
        deliveredAt: { gte: startOfMonth },
      },
      select: { deliveredAt: true, riderEarningXaf: true },
    });
    const byDay = new Map<string, number>();
    for (const d of daily) {
      if (!d.deliveredAt) continue;
      const key = d.deliveredAt.toISOString().slice(0, 10);
      byDay.set(key, (byDay.get(key) ?? 0) + (d.riderEarningXaf ?? 0));
    }
    const dailySeries: Array<{ date: string; earningsXaf: number }> = [];
    for (let i = 29; i >= 0; i--) {
      const day = new Date(now);
      day.setDate(day.getDate() - i);
      const key = day.toISOString().slice(0, 10);
      dailySeries.push({ date: key, earningsXaf: byDay.get(key) ?? 0 });
    }

    const reviewsCount = await this.prisma.review.count({
      where: {
        riderRating: { not: null },
        order: { riderId: riderUserId },
      },
    });

    return {
      today,
      week: { ...week, vsLastWeekPct },
      month,
      allTime: {
        totalTrips: profile.totalTrips,
        totalEarnings: (
          await this.prisma.riderEarning.aggregate({
            where: { riderId: profile.id },
            _sum: { netXaf: true },
          })
        )._sum.netXaf ?? 0,
        rating: profile.avgRating,
        reviewsCount,
      },
      dailySeries,
    };
  }
}
