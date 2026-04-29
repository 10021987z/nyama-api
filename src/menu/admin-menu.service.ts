import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EventsService } from '../events/events.service';
import { QueryAdminMenuDto } from './dto/query-admin-menu.dto';
import { AdminUpdateMenuItemDto } from './dto/admin-update-menu-item.dto';

const COOK_SELECT = {
  id: true,
  userId: true,
  displayName: true,
  avgRating: true,
  totalOrders: true,
  isActive: true,
  quarter: { select: { id: true, name: true, city: true } },
} satisfies Prisma.CookProfileSelect;

@Injectable()
export class AdminMenuService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsService,
  ) {}

  /**
   * GET /admin/menu/all — vue admin globale, avec filtres et stats agrégées.
   * Pas de pagination (le pilote a < 200 plats au total).
   */
  async listAll(dto: QueryAdminMenuDto) {
    const where: Prisma.MenuItemWhereInput = {
      ...(dto.cookId ? { cookId: dto.cookId } : {}),
      ...(dto.category ? { category: dto.category } : {}),
      ...(dto.available === 'true' ? { isAvailable: true } : {}),
      ...(dto.available === 'false' ? { isAvailable: false } : {}),
      ...(dto.search ? { name: { contains: dto.search } } : {}),
    };

    const items = await this.prisma.menuItem.findMany({
      where,
      include: { cook: { select: COOK_SELECT } },
      orderBy: [
        { cook: { displayName: 'asc' } },
        { category: 'asc' },
        { name: 'asc' },
      ],
    });

    // Stats agrégées sur le résultat filtré
    const totalDishes = items.length;
    const dishesAvailable = items.filter((i) => i.isAvailable).length;
    const dishesUnavailable = totalDishes - dishesAvailable;
    const avgPrice = totalDishes
      ? Math.round(items.reduce((s, i) => s + i.priceXaf, 0) / totalDishes)
      : 0;
    const categories = Array.from(new Set(items.map((i) => i.category))).sort();

    return {
      stats: { totalDishes, dishesAvailable, dishesUnavailable, avgPrice, categories },
      items,
    };
  }

  /**
   * GET /admin/menu/by-cook — même données regroupées par cuisinière.
   * Pratique pour la vue accordion du dashboard.
   */
  async listByCook(dto: QueryAdminMenuDto) {
    const { items, stats } = await this.listAll(dto);

    type Group = {
      cook: NonNullable<(typeof items)[number]['cook']>;
      dishes: typeof items;
      totalDishes: number;
      totalAvailable: number;
    };
    const groups: Record<string, Group> = {};

    for (const item of items) {
      if (!item.cook) continue;
      const key = item.cook.id;
      if (!groups[key]) {
        groups[key] = {
          cook: item.cook,
          dishes: [],
          totalDishes: 0,
          totalAvailable: 0,
        };
      }
      groups[key].dishes.push(item);
      groups[key].totalDishes++;
      if (item.isAvailable) groups[key].totalAvailable++;
    }

    return { stats, groups };
  }

  /**
   * PATCH /admin/menu-items/:id — override admin (modération, prix, dispo).
   * Émet menu:updated avec action=admin_modified pour que les apps Pro/Client
   * se rafraîchissent automatiquement.
   */
  async adminUpdate(itemId: string, dto: AdminUpdateMenuItemDto, adminId: string) {
    const existing = await this.prisma.menuItem.findUnique({ where: { id: itemId } });
    if (!existing) throw new NotFoundException('Plat introuvable');

    const updated = await this.prisma.menuItem.update({
      where: { id: itemId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.priceXaf !== undefined ? { priceXaf: dto.priceXaf } : {}),
        ...(dto.category !== undefined ? { category: dto.category } : {}),
        ...(dto.isAvailable !== undefined ? { isAvailable: dto.isAvailable } : {}),
        ...(dto.isDailySpecial !== undefined ? { isDailySpecial: dto.isDailySpecial } : {}),
      },
      include: { cook: { select: COOK_SELECT } },
    });

    this.events.emitMenuUpdated(updated.cookId, 'updated', {
      ...updated,
      adminAction: { type: 'admin_modified', adminId, reason: dto.reason ?? null },
    });

    return updated;
  }

  /**
   * DELETE /admin/menu-items/:id — soft-delete admin (mise hors-ligne).
   * Le plat reste en DB pour traçabilité, mais isAvailable=false.
   */
  async adminDelete(itemId: string, adminId: string, reason?: string) {
    const existing = await this.prisma.menuItem.findUnique({ where: { id: itemId } });
    if (!existing) throw new NotFoundException('Plat introuvable');

    const updated = await this.prisma.menuItem.update({
      where: { id: itemId },
      data: { isAvailable: false },
      include: { cook: { select: COOK_SELECT } },
    });

    this.events.emitMenuUpdated(updated.cookId, 'deleted', {
      ...updated,
      adminAction: { type: 'admin_deleted', adminId, reason: reason ?? null },
    });

    return { ok: true, item: updated };
  }
}
