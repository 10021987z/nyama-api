import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { paginatedResult, paginationParams } from '../common/pagination.helper';
import { QueryMenuDto } from './dto/query-menu.dto';

const COOK_SELECT = {
  id: true,
  displayName: true,
  avgRating: true,
  landmark: true,
  prepTimeAvgMin: true,
  quarter: { select: { name: true, city: true } },
} satisfies Prisma.CookProfileSelect;

@Injectable()
export class MenuService {
  constructor(private readonly prisma: PrismaService) {}

  async findItems(dto: QueryMenuDto) {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    const { skip, take } = paginationParams(page, limit);

    const where: Prisma.MenuItemWhereInput = {
      isAvailable: true,
      cook: {
        isActive: true,
        ...(dto.quarter_id ? { quarterId: dto.quarter_id } : {}),
      },
      ...(dto.category ? { category: dto.category } : {}),
      // SQLite: contains est case-sensitive. En prod PostgreSQL ajouter mode:'insensitive'
      ...(dto.search ? { name: { contains: dto.search } } : {}),
    };

    const [total, data] = await Promise.all([
      this.prisma.menuItem.count({ where }),
      this.prisma.menuItem.findMany({
        where,
        include: { cook: { select: COOK_SELECT } },
        orderBy: [{ isDailySpecial: 'desc' }, { cook: { avgRating: 'desc' } }],
        skip,
        take,
      }),
    ]);

    return paginatedResult(data, total, page, limit);
  }

  async findItemById(id: string) {
    const item = await this.prisma.menuItem.findUnique({
      where: { id },
      include: { cook: { select: COOK_SELECT } },
    });
    if (!item) throw new NotFoundException('Plat introuvable');
    return item;
  }
}
