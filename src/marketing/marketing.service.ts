import { Injectable } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MarketingService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview() {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [totalUsers, deliveredThisMonth] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.order.findMany({
        where: { status: OrderStatus.DELIVERED, createdAt: { gte: monthStart } },
        select: { totalXaf: true },
      }),
    ]);

    const revenueThisMonth = deliveredThisMonth.reduce((s, o) => s + o.totalXaf, 0);

    return {
      stats: {
        conversionRate: 24.8,
        activeCoupons: 0,
        pushReach: totalUsers,
        marketingRevenue: Math.round(revenueThisMonth * 0.15),
      },
      influencers: [
        { name: 'Manga 237', type: 'Lifestyle & Gastronomy', code: 'MANGA237', uses: 412, revenueXaf: 540000, trend: -15 },
        { name: 'Caryne Cooks', type: 'Chef & Content Creator', code: 'CARYNE_COOKS', uses: 280, revenueXaf: 280000, trend: -10 },
      ],
      promotions: [
        { name: '-10% sur le Ndolé Royal', code: 'NDOLE10', expiresAt: '2026-10-15', uses: 842 },
        { name: 'Livraison Gratuite (Wouri)', code: 'DOUALAFREE', expiresAt: '2026-10-30', uses: 1205 },
      ],
      campaigns: [
        {
          date: "Aujourd'hui 09:15",
          message: 'Le DG vous invite à sa table... Découvrez nos nouvelles recettes',
          audience: totalUsers,
          openRate: 72,
        },
      ],
      calendarEvents: [
        { date: '2026-10-24', title: 'Festival du Poisson Braisé', code: 'PROMOPOISSON' },
        { date: '2026-11-02', title: "Journée de l'Unité Culinaire", action: 'Notification Push Global' },
      ],
    };
  }
}
