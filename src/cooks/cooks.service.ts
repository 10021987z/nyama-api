import {
  Injectable,
  Logger,
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
import { SetAvailabilityDto } from './dto/set-availability.dto';
import { SetRushDto } from './dto/set-rush.dto';
import { SendOrderMessageDto } from './dto/send-order-message.dto';
import { EventsService } from '../events/events.service';

// Les statuts où la commande est "active" côté cuisinière (compte pour le calcul
// de la charge / temps de préparation estimé).
const ACTIVE_COOK_STATUSES: OrderStatus[] = [
  OrderStatus.CONFIRMED,
  OrderStatus.PREPARING,
  OrderStatus.READY,
];

const DEFAULT_PREP_TIME_MIN = 15;
const RUSH_DEFAULT_MINUTES = 15;
const RUSH_PREP_TIME_BONUS_MIN = 30;

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
  private readonly logger = new Logger(CooksService.name);

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

    const [total, rawData] = await Promise.all([
      this.prisma.cookProfile.count({ where }),
      this.prisma.cookProfile.findMany({
        where,
        include: { quarter: { select: { name: true, city: true } } },
        orderBy,
        skip,
        take,
      }),
    ]);

    // Décoration rush : si la cuisinière est en rush et que rushUntil > now,
    // on expose `isRush: true` et on ajoute +30 min au temps de prépa estimé.
    // Sinon on renvoie `isRush: false` et le temps base. L'app cliente peut
    // afficher "Très demandé - délai 45min" en se basant sur ce flag.
    const now = new Date();
    const data = rawData.map((c) => {
      const baseTime = c.prepTimeAvgMin ?? DEFAULT_PREP_TIME_MIN;
      const rushActive =
        c.isRush && c.rushUntil !== null && c.rushUntil > now;
      return {
        ...c,
        isRush: rushActive,
        rushReason: rushActive ? c.rushReason : null,
        rushUntil: rushActive ? c.rushUntil : null,
        estimatedPrepTimeMin: rushActive
          ? baseTime + RUSH_PREP_TIME_BONUS_MIN
          : baseTime,
      };
    });

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

  async acceptOrder(orderId: string, cookUserId: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Commande introuvable');
    if (order.cookId !== cookUserId)
      throw new ForbiddenException('Cette commande ne vous appartient pas');

    let targetStatus: OrderStatus;
    if (order.status === OrderStatus.PENDING) {
      targetStatus = OrderStatus.CONFIRMED;
    } else if (order.status === OrderStatus.CONFIRMED) {
      targetStatus = OrderStatus.PREPARING;
    } else {
      throw new BadRequestException(
        `Impossible d'accepter une commande au statut ${order.status}`,
      );
    }

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: { status: targetStatus, acceptedAt: new Date() },
      include: ORDER_INCLUDE,
    });

    this.logger.log(
      `📡 emit('order:status') → rooms: order-${orderId}, cook-${order.cookId}, client-${order.clientId}${order.riderId ? ', rider-' + order.riderId : ''} | payload: status=${targetStatus}`,
    );
    this.eventsService.emitToOrderRoom(orderId, 'order:status', {
      orderId,
      status: targetStatus,
    });
    this.eventsService.notifyClient(order.clientId, 'order:status', {
      orderId,
      status: targetStatus,
    });
    this.eventsService.notifyCook(order.cookId, 'order:status', {
      orderId,
      status: targetStatus,
    });
    if (order.riderId) {
      this.eventsService.notifyRider(order.riderId, 'order:status', {
        orderId,
        status: targetStatus,
      });
    }

    return updated;
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

    // Notifier le client, la cuisinière et (si assigné) le livreur
    this.logger.log(
      `📡 emit('order:status') → rooms: order-${orderId}, cook-${order.cookId}, client-${order.clientId}${order.riderId ? ', rider-' + order.riderId : ''} | payload: status=${targetStatus}`,
    );
    this.eventsService.emitToOrderRoom(orderId, 'order:status', {
      orderId,
      status: targetStatus,
    });
    this.eventsService.notifyClient(order.clientId, 'order:status', {
      orderId,
      status: targetStatus,
    });
    this.eventsService.notifyCook(order.cookId, 'order:status', {
      orderId,
      status: targetStatus,
    });
    if (order.riderId) {
      this.eventsService.notifyRider(order.riderId, 'order:status', {
        orderId,
        status: targetStatus,
      });
    }

    // Si READY → notifier les livreurs disponibles
    if (targetStatus === OrderStatus.READY) {
      const cookProfile = await this.prisma.cookProfile.findUnique({
        where: { userId: cookUserId },
        select: { quarterId: true },
      });
      this.logger.log(
        `📡 emit('order:ready') → rooms: riders:${cookProfile?.quarterId ?? 'all'} | payload: orderId=${orderId} totalXaf=${order.totalXaf}`,
      );
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

  /**
   * Menu public d'un cook (utilisé par l'app Client).
   * `cookProfileId` est l'id du CookProfile (pas du User).
   */
  async getPublicMenuItems(cookProfileId: string, includeUnavailable: boolean) {
    const cook = await this.prisma.cookProfile.findUnique({
      where: { id: cookProfileId },
      select: { id: true },
    });
    if (!cook) throw new NotFoundException('Cuisinière introuvable');

    return this.prisma.menuItem.findMany({
      where: {
        cookId: cookProfileId,
        ...(includeUnavailable ? {} : { isAvailable: true }),
      },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });
  }

  async createMenuItem(cookUserId: string, dto: CreateMenuItemDto) {
    const profile = await this.getCookProfile(cookUserId);
    const created = await this.prisma.menuItem.create({
      data: { ...dto, cookId: profile.id },
    });
    this.eventsService.emitMenuUpdated(profile.id, 'created', created);
    return created;
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

    const updated = await this.prisma.menuItem.update({
      where: { id: itemId },
      data: dto,
    });
    this.eventsService.emitMenuUpdated(profile.id, 'updated', updated);
    return updated;
  }

  async softDeleteMenuItem(itemId: string, cookUserId: string) {
    const profile = await this.getCookProfile(cookUserId);
    const item = await this.prisma.menuItem.findUnique({ where: { id: itemId } });
    if (!item) throw new NotFoundException('Plat introuvable');
    if (item.cookId !== profile.id)
      throw new ForbiddenException('Ce plat ne vous appartient pas');

    // Suppression physique : l'app Pro attend un DELETE qui retire vraiment
    // le plat. Si des OrderItem référencent ce menuItem (FK), on retombe sur
    // une désactivation (soft delete).
    try {
      const deleted = await this.prisma.menuItem.delete({ where: { id: itemId } });
      this.eventsService.emitMenuUpdated(profile.id, 'deleted', deleted);
      return deleted;
    } catch {
      const soft = await this.prisma.menuItem.update({
        where: { id: itemId },
        data: { isAvailable: false },
      });
      this.eventsService.emitMenuUpdated(profile.id, 'updated', soft);
      return soft;
    }
  }

  async setMenuItemAvailability(
    itemId: string,
    cookUserId: string,
    dto: SetAvailabilityDto,
  ) {
    const profile = await this.getCookProfile(cookUserId);
    const item = await this.prisma.menuItem.findUnique({ where: { id: itemId } });
    if (!item) throw new NotFoundException('Plat introuvable');
    if (item.cookId !== profile.id)
      throw new ForbiddenException('Ce plat ne vous appartient pas');

    const updated = await this.prisma.menuItem.update({
      where: { id: itemId },
      data: {
        isAvailable: dto.available,
        unavailableReason: dto.available ? null : dto.reason ?? null,
      },
    });
    this.eventsService.emitMenuUpdated(profile.id, 'availability', updated);
    return updated;
  }

  // ─── STATS ───────────────────────────────────────────────

  /**
   * Renvoie le début du jour en heure locale Douala (UTC+1) exprimé en UTC.
   * On veut "aujourd'hui à 00:00 locale" → on soustrait 1h pour que la date
   * UTC corresponde au début du jour local.
   */
  private getDoualaDayStart(): Date {
    const now = new Date();
    const todayUtc = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0),
    );
    // Si on est entre 00h UTC et 01h UTC, on est encore la veille en heure
    // locale Douala (UTC+1). Pour simplifier : début du jour local = 00h-1h UTC.
    return new Date(todayUtc.getTime() - 60 * 60 * 1000);
  }

  /** Lundi 00:00 locale Douala de la semaine qui contient `ref`. */
  private getDoualaWeekStart(ref: Date): Date {
    const d = new Date(ref);
    // getUTCDay: 0=dim, 1=lun, ... 6=sam
    const day = d.getUTCDay();
    const diffToMonday = (day + 6) % 7; // lundi = 0, dimanche = 6
    const mondayUtcMidnight = new Date(
      Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - diffToMonday, 0, 0, 0),
    );
    // Début local Douala = 00h locale = 23h UTC la veille → -1h
    return new Date(mondayUtcMidnight.getTime() - 60 * 60 * 1000);
  }

  async getStatsToday(cookUserId: string) {
    const profile = await this.getCookProfile(cookUserId);
    const todayStart = this.getDoualaDayStart();

    const [ordersCount, deliveredToday] = await Promise.all([
      this.prisma.order.count({
        where: {
          cookId: cookUserId,
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
    ]);

    const revenueXaf = deliveredToday.reduce((sum, o) => sum + o.totalXaf, 0);

    // Review n'a pas de champ date filtrable sans jointure coûteuse par cook :
    // on renvoie la moyenne all-time depuis CookProfile.avgRating.
    const avgRating = profile.avgRating;

    const prepTimeAvg = profile.prepTimeAvgMin ?? DEFAULT_PREP_TIME_MIN;

    return { ordersCount, revenueXaf, avgRating, prepTimeAvg };
  }

  async getStatsWeekly(cookUserId: string) {
    await this.getCookProfile(cookUserId);

    const now = new Date();
    const currentWeekStart = this.getDoualaWeekStart(now);
    const previousWeekStart = new Date(
      currentWeekStart.getTime() - 7 * 24 * 60 * 60 * 1000,
    );
    const previousWeekEnd = currentWeekStart;

    const computeAggregates = async (from: Date, to?: Date) => {
      const dateFilter: Prisma.DateTimeFilter = to ? { gte: from, lt: to } : { gte: from };

      const [orders, delivered, reviews] = await Promise.all([
        this.prisma.order.count({
          where: { cookId: cookUserId, createdAt: dateFilter },
        }),
        this.prisma.order.findMany({
          where: {
            cookId: cookUserId,
            status: OrderStatus.DELIVERED,
            createdAt: dateFilter,
          },
          select: { totalXaf: true },
        }),
        this.prisma.review.findMany({
          where: {
            createdAt: dateFilter,
            order: { cookId: cookUserId },
            cookRating: { not: null },
          },
          select: { cookRating: true },
        }),
      ]);

      const revenue = delivered.reduce((sum, o) => sum + o.totalXaf, 0);
      const ratings = reviews
        .map((r) => r.cookRating)
        .filter((v): v is number => typeof v === 'number');
      const rating =
        ratings.length > 0
          ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
          : 0;

      return { orders, revenue, rating };
    };

    const [currentWeek, previousWeek] = await Promise.all([
      computeAggregates(currentWeekStart),
      computeAggregates(previousWeekStart, previousWeekEnd),
    ]);

    let growthPercent: number;
    if (previousWeek.revenue === 0) {
      growthPercent = currentWeek.revenue > 0 ? 100 : 0;
    } else {
      growthPercent =
        Math.round(
          ((currentWeek.revenue - previousWeek.revenue) / previousWeek.revenue) * 1000,
        ) / 10;
    }

    return { currentWeek, previousWeek, growthPercent };
  }

  async getPrepTimeEstimate(cookUserId: string) {
    const profile = await this.getCookProfile(cookUserId);
    const base = profile.prepTimeAvgMin ?? DEFAULT_PREP_TIME_MIN;

    const activeOrdersCount = await this.prisma.order.count({
      where: {
        cookId: cookUserId,
        status: { in: ACTIVE_COOK_STATUSES },
      },
    });

    let estimatedPrepTimeMin = base;
    if (activeOrdersCount >= 6) estimatedPrepTimeMin = base + 20;
    else if (activeOrdersCount >= 3) estimatedPrepTimeMin = base + 10;

    return { activeOrdersCount, estimatedPrepTimeMin };
  }

  // ─── RUSH MODE ───────────────────────────────────────────

  async setRushStatus(cookUserId: string, dto: SetRushDto) {
    const profile = await this.getCookProfile(cookUserId);

    if (dto.rush) {
      const now = new Date();
      const duration = dto.durationMinutes ?? RUSH_DEFAULT_MINUTES;
      const rushUntil = new Date(now.getTime() + duration * 60 * 1000);

      return this.prisma.cookProfile.update({
        where: { id: profile.id },
        data: {
          isRush: true,
          rushReason: dto.reason ?? null,
          rushStartedAt: now,
          rushUntil,
        },
      });
    }

    return this.prisma.cookProfile.update({
      where: { id: profile.id },
      data: {
        isRush: false,
        rushReason: null,
        rushStartedAt: null,
        rushUntil: null,
      },
    });
  }

  // ─── CHAT COOK ↔ RIDER ───────────────────────────────────

  /** Vérifie que l'utilisateur cuisinière est propriétaire de la commande. */
  private async assertCookOwnsOrder(orderId: string, cookUserId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, cookId: true },
    });
    if (!order) throw new NotFoundException('Commande introuvable');
    if (order.cookId !== cookUserId)
      throw new ForbiddenException('Cette commande ne vous appartient pas');
    return order;
  }

  async listOrderMessagesAsCook(orderId: string, cookUserId: string) {
    await this.assertCookOwnsOrder(orderId, cookUserId);
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

  async postOrderMessageAsCook(
    orderId: string,
    cookUserId: string,
    dto: SendOrderMessageDto,
  ) {
    await this.assertCookOwnsOrder(orderId, cookUserId);
    const message = await this.prisma.orderMessage.create({
      data: {
        orderId,
        senderId: cookUserId,
        senderRole: 'COOK',
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
      `📡 emit('message:new') → rooms: order-${orderId} | payload: senderRole=COOK`,
    );
    this.eventsService.emitToOrderRoom(orderId, 'message:new', { ...message, orderId });
    return message;
  }

  // ─── Cook profile (self) ─────────────────────────────────────────
  // Endpoints consommés par l'app Pro (restaurant_presentation_screen).

  async getCookProfileSelf(cookUserId: string) {
    const profile = await this.getCookProfile(cookUserId);
    // Renvoie le profile + le phone du User pour que le formulaire app puisse
    // pré-remplir le champ téléphone. specialty et openingHours sont parsés
    // côté serveur pour économiser un parse au client (l'app accepte les 2).
    const user = await this.prisma.user.findUnique({
      where: { id: cookUserId },
      select: { phone: true },
    });
    let specialty: string[] = [];
    try {
      const parsed = JSON.parse(profile.specialty || '[]');
      if (Array.isArray(parsed)) specialty = parsed.map(String);
    } catch {
      specialty = [];
    }
    let openingHours: Record<string, unknown> | null = null;
    if (profile.openingHours) {
      try {
        openingHours = JSON.parse(profile.openingHours);
      } catch {
        openingHours = null;
      }
    }
    return {
      ...profile,
      phone: user?.phone ?? null,
      specialty,
      openingHours,
    };
  }

  async updateCookProfileSelf(
    cookUserId: string,
    dto: import('./dto/update-cook-profile.dto').UpdateCookProfileDto,
  ) {
    const profile = await this.getCookProfile(cookUserId);

    const data: Prisma.CookProfileUpdateInput = {};
    if (dto.displayName !== undefined) data.displayName = dto.displayName;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.landmark !== undefined) data.landmark = dto.landmark;
    if (dto.prepTimeAvgMin !== undefined)
      data.prepTimeAvgMin = dto.prepTimeAvgMin;
    if (dto.specialty !== undefined)
      data.specialty = JSON.stringify(dto.specialty);
    if (dto.openingHours !== undefined)
      data.openingHours = JSON.stringify(dto.openingHours);

    const updated = await this.prisma.cookProfile.update({
      where: { id: profile.id },
      data,
    });

    // phone est sur User, pas CookProfile — propagation optionnelle si fourni.
    if (dto.phone !== undefined && dto.phone.trim()) {
      try {
        await this.prisma.user.update({
          where: { id: cookUserId },
          data: { phone: dto.phone.trim() },
        });
      } catch (e) {
        // Conflit de phone unique: on ignore en silence côté backend, l'app
        // continue de fonctionner avec le phone précédent.
        this.logger.warn(
          `phone update skipped for ${cookUserId}: ${(e as Error).message}`,
        );
      }
    }

    return this.getCookProfileSelf(cookUserId);
  }
}
