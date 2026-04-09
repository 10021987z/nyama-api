import { Controller, Get, Query } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { paginatedResult, paginationParams } from '../common/pagination.helper';

@Controller('riders')
export class RidersController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const p = page ? parseInt(page, 10) : 1;
    const l = limit ? parseInt(limit, 10) : 20;
    const { skip, take } = paginationParams(p, l);

    const where = { role: UserRole.RIDER };
    const [total, data] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          phone: true,
          name: true,
          avatarUrl: true,
          createdAt: true,
          riderProfile: true,
        },
      }),
    ]);

    return paginatedResult(data, total, p, l);
  }
}
