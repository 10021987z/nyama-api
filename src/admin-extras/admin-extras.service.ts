import { Injectable, BadRequestException } from '@nestjs/common';
import { OrderStatus, DeliveryStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const COMMISSION_RATE_DEFAULT = 0.15;
const RIDER_FEE_PER_DELIVERY = 800;
const COOK_CAPACITY = 100;

type CrisisState = {
  active: boolean;
  reason: string | null;
  startedAt: string | null;
  endsAt: string | null;
  triggeredBy: string | null;
};

@Injectable()
export class AdminExtrasService {
  // Mode crise — état en mémoire (suffisant pour pilote, perdu au redémarrage)
  private crisis: CrisisState = {
    active: false,
    reason: null,
    startedAt: null,
    endsAt: null,
    triggeredBy: null,
  };

  constructor(private readonly prisma: PrismaService) {}

  // ─── 1) Commissions par cook (sur orders DELIVERED) ────────
  async getCommissions(period: '30d' | '7d' = '30d') {
    const days = period === '7d' ? 7 : 30;
    const since = new Date();
    since.setDate(since.getDate() - days);

    const groups = await this.prisma.order.groupBy({
      by: ['cookId'],
      where: { status: OrderStatus.DELIVERED, createdAt: { gte: since } },
      _sum: { totalXaf: true },
      _count: { id: true },
    });

    const cookIds = groups.map((g) => g.cookId);
    const profiles = await this.prisma.cookProfile.findMany({
      where: { userId: { in: cookIds } },
      select: { id: true, userId: true, displayName: true, avgRating: true },
    });

    const items = groups
      .map((g) => {
        const cook = profiles.find((p) => p.userId === g.cookId);
        const gross = g._sum.totalXaf ?? 0;
        const rate = COMMISSION_RATE_DEFAULT;
        const commission = Math.round(gross * rate);
        return {
          cookProfileId: cook?.id ?? null,
          cookUserId: g.cookId,
          name: cook?.displayName ?? '—',
          avgRating: cook?.avgRating ?? null,
          orderCount: g._count.id,
          grossXaf: gross,
          rate,
          commissionXaf: commission,
        };
      })
      .sort((a, b) => b.grossXaf - a.grossXaf);

    const totals = {
      grossXaf: items.reduce((s, i) => s + i.grossXaf, 0),
      commissionXaf: items.reduce((s, i) => s + i.commissionXaf, 0),
      orderCount: items.reduce((s, i) => s + i.orderCount, 0),
      cookCount: items.length,
    };

    return { period, days, totals, items };
  }

  // ─── 2) Trésorerie NYAMA (solde + alertes simples) ────────
  async getTreasury() {
    const since30 = new Date();
    since30.setDate(since30.getDate() - 30);

    const [delivered30, payments30, cancelled30] = await Promise.all([
      this.prisma.order.aggregate({
        where: { status: OrderStatus.DELIVERED, createdAt: { gte: since30 } },
        _sum: { totalXaf: true, deliveryFeeXaf: true },
        _count: { id: true },
      }),
      this.prisma.payment.aggregate({
        where: { status: 'SUCCESS', createdAt: { gte: since30 } },
        _sum: { amountXaf: true },
      }),
      this.prisma.order.count({
        where: { status: OrderStatus.CANCELLED, createdAt: { gte: since30 } },
      }),
    ]);

    const gross = delivered30._sum.totalXaf ?? 0;
    const commission = Math.round(gross * COMMISSION_RATE_DEFAULT);
    const deliveryFees = delivered30._sum.deliveryFeeXaf ?? 0;
    // Solde estimé : commissions + frais de livraison NYAMA - couts riders (frais x #livraisons)
    const riderPayouts = (delivered30._count.id ?? 0) * RIDER_FEE_PER_DELIVERY;
    const balanceXaf = commission + deliveryFees - riderPayouts;

    const alerts: Array<{ level: 'info' | 'warn' | 'crit'; message: string }> = [];
    if (balanceXaf < 100_000) {
      alerts.push({ level: 'crit', message: `Solde estimé bas : ${balanceXaf} FCFA` });
    } else if (balanceXaf < 500_000) {
      alerts.push({ level: 'warn', message: `Solde modéré : ${balanceXaf} FCFA` });
    }
    if (cancelled30 > delivered30._count.id * 0.1) {
      alerts.push({
        level: 'warn',
        message: `Taux d'annulation élevé : ${cancelled30}/${delivered30._count.id} sur 30j`,
      });
    }

    return {
      balanceXaf,
      breakdown: {
        grossRevenueXaf: gross,
        commissionXaf: commission,
        deliveryFeesXaf: deliveryFees,
        riderPayoutsXaf: riderPayouts,
      },
      kpis: {
        ordersDelivered30d: delivered30._count.id ?? 0,
        ordersCancelled30d: cancelled30,
        paymentsSuccessXaf30d: payments30._sum.amountXaf ?? 0,
      },
      alerts,
    };
  }

  // ─── 3) Fiche paie d'un livreur sur une semaine ────────────
  async getRiderPayslip(riderUserId: string, weekIso?: string) {
    // weekIso au format 'YYYY-Www' — défaut : semaine courante
    const { start, end, weekLabel } = this.weekRange(weekIso);

    const riderProfile = await this.prisma.riderProfile.findUnique({
      where: { userId: riderUserId },
      select: { id: true, user: { select: { id: true, name: true, phone: true } } },
    });
    if (!riderProfile) {
      return {
        rider: null,
        week: weekLabel,
        deliveries: [],
        totals: { count: 0, earningsXaf: 0 },
      };
    }

    const deliveries = await this.prisma.delivery.findMany({
      where: {
        riderId: riderProfile.id,
        status: DeliveryStatus.DELIVERED,
        deliveredAt: { gte: start, lte: end },
      },
      include: {
        order: { select: { id: true, totalXaf: true, deliveryAddress: true } },
      },
      orderBy: { deliveredAt: 'asc' },
    });

    const items = deliveries.map((d) => ({
      deliveryId: d.id,
      orderId: d.orderId,
      date: d.deliveredAt?.toISOString() ?? null,
      address: d.order.deliveryAddress,
      earningXaf: d.riderEarningXaf ?? RIDER_FEE_PER_DELIVERY,
    }));

    return {
      rider: {
        id: riderProfile.user.id,
        name: riderProfile.user.name,
        phone: riderProfile.user.phone,
      },
      week: weekLabel,
      periodStart: start.toISOString(),
      periodEnd: end.toISOString(),
      deliveries: items,
      totals: {
        count: items.length,
        earningsXaf: items.reduce((s, i) => s + i.earningXaf, 0),
      },
    };
  }

  // ─── 4) Heatmap des commandes (24h) ────────────────────────
  async getHeatmap(period: '24h' | '7d' = '24h') {
    const since = new Date();
    if (period === '7d') since.setDate(since.getDate() - 7);
    else since.setHours(since.getHours() - 24);

    const orders = await this.prisma.order.findMany({
      where: { createdAt: { gte: since } },
      select: {
        id: true,
        deliveryLat: true,
        deliveryLng: true,
        cookId: true,
        status: true,
        createdAt: true,
      },
      take: 2000,
    });

    const cookIds = Array.from(new Set(orders.map((o) => o.cookId)));
    const cookProfiles = await this.prisma.cookProfile.findMany({
      where: { userId: { in: cookIds } },
      select: { userId: true, locationLat: true, locationLng: true, displayName: true },
    });
    const cookMap = new Map(cookProfiles.map((c) => [c.userId, c]));

    const points = orders.map((o) => {
      const c = cookMap.get(o.cookId);
      return {
        orderId: o.id,
        lat: o.deliveryLat,
        lng: o.deliveryLng,
        cookLat: c?.locationLat ?? null,
        cookLng: c?.locationLng ?? null,
        cookName: c?.displayName ?? null,
        status: o.status,
        createdAt: o.createdAt.toISOString(),
        weight: 1,
      };
    });

    return { period, count: points.length, points };
  }

  // ─── 5) Historique CA jour par jour (14j) ──────────────────
  async getRevenueHistory(days = 14) {
    const since = new Date();
    since.setDate(since.getDate() - days);
    since.setHours(0, 0, 0, 0);

    const orders = await this.prisma.order.findMany({
      where: { status: OrderStatus.DELIVERED, createdAt: { gte: since } },
      select: { totalXaf: true, createdAt: true },
    });

    // Grouper par jour
    const map = new Map<string, { revenue: number; orders: number }>();
    // Initialise tous les jours à 0 pour avoir une série continue
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      d.setHours(0, 0, 0, 0);
      const key = d.toISOString().slice(0, 10);
      map.set(key, { revenue: 0, orders: 0 });
    }
    for (const o of orders) {
      const key = o.createdAt.toISOString().slice(0, 10);
      const cur = map.get(key) ?? { revenue: 0, orders: 0 };
      cur.revenue += o.totalXaf;
      cur.orders += 1;
      map.set(key, cur);
    }

    const series = Array.from(map.entries())
      .map(([date, v]) => ({ date, revenue: v.revenue, orders: v.orders }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return { days, series };
  }

  // ─── 6) Charge actuelle des cooks ──────────────────────────
  async getCooksLoad() {
    const profiles = await this.prisma.cookProfile.findMany({
      where: { isActive: true },
      select: {
        id: true,
        userId: true,
        displayName: true,
        avgRating: true,
        prepTimeAvgMin: true,
        isRush: true,
      },
    });

    // Compter les commandes "en cours" (pas DELIVERED ni CANCELLED)
    const active = await this.prisma.order.groupBy({
      by: ['cookId'],
      where: {
        status: { notIn: [OrderStatus.DELIVERED, OrderStatus.CANCELLED] },
      },
      _count: { id: true },
    });
    const activeMap = new Map(active.map((g) => [g.cookId, g._count.id]));

    const items = profiles
      .map((p) => {
        const load = activeMap.get(p.userId) ?? 0;
        return {
          cookProfileId: p.id,
          cookUserId: p.userId,
          name: p.displayName,
          avgRating: p.avgRating,
          load,
          capacity: COOK_CAPACITY,
          loadPct: Math.min(100, Math.round((load / COOK_CAPACITY) * 100)),
          isRush: p.isRush,
          prepTimeAvgMin: p.prepTimeAvgMin,
        };
      })
      .sort((a, b) => b.loadPct - a.loadPct);

    return { count: items.length, items };
  }

  // ─── 7) Leaderboard riders ─────────────────────────────────
  async getRidersLeaderboard(period: 'week' | 'month' = 'week') {
    const since = new Date();
    if (period === 'week') since.setDate(since.getDate() - 7);
    else since.setDate(since.getDate() - 30);

    const groups = await this.prisma.delivery.groupBy({
      by: ['riderId'],
      where: { status: DeliveryStatus.DELIVERED, deliveredAt: { gte: since } },
      _count: { id: true },
      _sum: { riderEarningXaf: true },
    });

    const profiles = await this.prisma.riderProfile.findMany({
      where: { id: { in: groups.map((g) => g.riderId) } },
      select: {
        id: true,
        userId: true,
        user: { select: { name: true, phone: true } },
      },
    });

    // Récupérer les ratings moyens (3 derniers mois pour stabilité)
    const ratings = await this.prisma.rating.groupBy({
      by: ['orderId'],
      _avg: { riderStars: true },
    });
    void ratings; // ratings sont via order.rider — calcul plus complexe, on simplifie

    const items = groups
      .map((g) => {
        const p = profiles.find((pr) => pr.id === g.riderId);
        return {
          riderProfileId: g.riderId,
          riderUserId: p?.userId ?? null,
          name: p?.user.name ?? '—',
          phone: p?.user.phone ?? null,
          deliveryCount: g._count.id,
          earningsXaf: g._sum.riderEarningXaf ?? g._count.id * RIDER_FEE_PER_DELIVERY,
        };
      })
      .sort((a, b) => b.deliveryCount - a.deliveryCount)
      .slice(0, 10);

    return { period, items };
  }

  // ─── 8) Leaderboard cooks ──────────────────────────────────
  async getCooksLeaderboard(period: 'week' | 'month' = 'week') {
    const since = new Date();
    if (period === 'week') since.setDate(since.getDate() - 7);
    else since.setDate(since.getDate() - 30);

    const groups = await this.prisma.order.groupBy({
      by: ['cookId'],
      where: { status: OrderStatus.DELIVERED, createdAt: { gte: since } },
      _count: { id: true },
      _sum: { totalXaf: true },
    });

    const profiles = await this.prisma.cookProfile.findMany({
      where: { userId: { in: groups.map((g) => g.cookId) } },
      select: { id: true, userId: true, displayName: true, avgRating: true },
    });

    const items = groups
      .map((g) => {
        const p = profiles.find((pr) => pr.userId === g.cookId);
        return {
          cookProfileId: p?.id ?? null,
          cookUserId: g.cookId,
          name: p?.displayName ?? '—',
          avgRating: p?.avgRating ?? 0,
          orderCount: g._count.id,
          revenueXaf: g._sum.totalXaf ?? 0,
        };
      })
      .sort((a, b) => b.orderCount - a.orderCount)
      .slice(0, 10);

    return { period, items };
  }

  // ─── 9) Mode crise ─────────────────────────────────────────
  getCrisisStatus() {
    if (this.crisis.active && this.crisis.endsAt) {
      const ends = new Date(this.crisis.endsAt).getTime();
      if (Date.now() > ends) {
        // expiré : on désactive
        this.crisis = {
          active: false,
          reason: null,
          startedAt: null,
          endsAt: null,
          triggeredBy: null,
        };
      }
    }
    return this.crisis;
  }

  activateCrisis(input: { minutes: number; reason: string; adminId: string }): CrisisState {
    if (!input.reason || input.reason.trim().length < 3) {
      throw new BadRequestException('Raison trop courte');
    }
    if (input.minutes < 1 || input.minutes > 720) {
      throw new BadRequestException('Durée invalide (1-720 min)');
    }
    const now = new Date();
    const ends = new Date(now.getTime() + input.minutes * 60_000);
    this.crisis = {
      active: true,
      reason: input.reason,
      startedAt: now.toISOString(),
      endsAt: ends.toISOString(),
      triggeredBy: input.adminId,
    };
    return this.crisis;
  }

  deactivateCrisis(): CrisisState {
    this.crisis = {
      active: false,
      reason: null,
      startedAt: null,
      endsAt: null,
      triggeredBy: null,
    };
    return this.crisis;
  }

  // ─── 10) Prédiction CA demain (avg simple sur 7 derniers jours)
  async predictTomorrow() {
    const history = await this.getRevenueHistory(14);
    const series = history.series;
    if (series.length === 0) {
      return { tomorrow: null, baseline: 0, confidence: 'low', basis: 'no data' };
    }

    // Moyenne 7 jours + multiplicateur jour de semaine (basé sur 14j)
    const last7 = series.slice(-7);
    const baseline = Math.round(
      last7.reduce((s, d) => s + d.revenue, 0) / last7.length,
    );

    // Multiplicateur jour de semaine
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dow = tomorrow.getDay();
    const sameDow = series.filter((d) => new Date(d.date).getDay() === dow);
    const dowAvg = sameDow.length
      ? sameDow.reduce((s, d) => s + d.revenue, 0) / sameDow.length
      : baseline;
    const dowMultiplier = baseline > 0 ? dowAvg / baseline : 1;

    const forecast = Math.round(baseline * dowMultiplier);
    const variance = sameDow.length
      ? Math.sqrt(
          sameDow.reduce((s, d) => s + (d.revenue - dowAvg) ** 2, 0) /
            sameDow.length,
        )
      : 0;

    return {
      tomorrow: tomorrow.toISOString().slice(0, 10),
      baseline,
      forecastXaf: forecast,
      dowMultiplier: Math.round(dowMultiplier * 100) / 100,
      varianceXaf: Math.round(variance),
      confidence: sameDow.length >= 2 ? 'medium' : 'low',
      basis: `avg 7 derniers jours × multiplicateur ${
        ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam'][dow]
      }`,
    };
  }

  // ─── helpers ────────────────────────────────────────────────
  private weekRange(weekIso?: string): { start: Date; end: Date; weekLabel: string } {
    let year: number, week: number;
    if (weekIso) {
      const m = /^(\d{4})-W(\d{2})$/.exec(weekIso);
      if (!m) throw new BadRequestException('week doit être au format YYYY-Www');
      year = parseInt(m[1], 10);
      week = parseInt(m[2], 10);
    } else {
      // Semaine courante (ISO 8601)
      const now = new Date();
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
      const dayNum = d.getUTCDay() || 7;
      d.setUTCDate(d.getUTCDate() + 4 - dayNum);
      year = d.getUTCFullYear();
      const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
      week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
    }

    // Premier jour ISO de la semaine = lundi
    const jan4 = new Date(Date.UTC(year, 0, 4));
    const jan4Dow = jan4.getUTCDay() || 7;
    const week1Mon = new Date(jan4);
    week1Mon.setUTCDate(jan4.getUTCDate() - jan4Dow + 1);
    const start = new Date(week1Mon);
    start.setUTCDate(week1Mon.getUTCDate() + (week - 1) * 7);
    const end = new Date(start);
    end.setUTCDate(start.getUTCDate() + 7);

    const weekLabel = `${year}-W${String(week).padStart(2, '0')}`;
    return { start, end, weekLabel };
  }
}
