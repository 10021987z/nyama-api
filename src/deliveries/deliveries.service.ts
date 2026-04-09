import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { paginatedResult, paginationParams } from '../common/pagination.helper';

@Injectable()
export class DeliveriesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(page = 1, limit = 20) {
    const { skip, take } = paginationParams(page, limit);
    const [total, data] = await Promise.all([
      this.prisma.delivery.count(),
      this.prisma.delivery.findMany({
        skip,
        take,
        orderBy: { assignedAt: 'desc' },
        include: {
          order: {
            select: {
              id: true,
              status: true,
              totalXaf: true,
              deliveryAddress: true,
              clientId: true,
              cookId: true,
            },
          },
          rider: {
            include: {
              user: { select: { id: true, name: true, phone: true } },
            },
          },
        },
      }),
    ]);
    return paginatedResult(data, total, page, limit);
  }
}
