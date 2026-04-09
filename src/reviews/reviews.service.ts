import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { paginatedResult, paginationParams } from '../common/pagination.helper';
import { CreateReviewDto } from './dto/create-review.dto';

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(page = 1, limit = 20) {
    const { skip, take } = paginationParams(page, limit);
    const [total, data] = await Promise.all([
      this.prisma.review.count(),
      this.prisma.review.findMany({
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          author: { select: { id: true, name: true, avatarUrl: true } },
          order: { select: { id: true, cookId: true, riderId: true } },
        },
      }),
    ]);
    return paginatedResult(data, total, page, limit);
  }

  async findByCook(cookId: string, page = 1, limit = 20) {
    const { skip, take } = paginationParams(page, limit);
    const where = { order: { cookId } };
    const [total, data] = await Promise.all([
      this.prisma.review.count({ where }),
      this.prisma.review.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          author: { select: { id: true, name: true, avatarUrl: true } },
        },
      }),
    ]);
    return paginatedResult(data, total, page, limit);
  }

  async create(clientId: string, dto: CreateReviewDto) {
    const order = await this.prisma.order.findUnique({
      where: { id: dto.orderId },
      include: { cook: true, rider: true },
    });
    if (!order) throw new NotFoundException('Commande introuvable');
    if (order.clientId !== clientId)
      throw new ForbiddenException('Vous n\'êtes pas le client de cette commande');
    if (order.status !== OrderStatus.DELIVERED)
      throw new BadRequestException('Seules les commandes livrées peuvent être évaluées');

    // Vérifier l'unicité
    const existing = await this.prisma.review.findUnique({
      where: { orderId_authorId: { orderId: dto.orderId, authorId: clientId } },
    });
    if (existing) throw new ConflictException('Vous avez déjà évalué cette commande');

    const review = await this.prisma.review.create({
      data: {
        orderId: dto.orderId,
        authorId: clientId,
        cookRating: dto.cookRating,
        riderRating: dto.riderRating,
        cookComment: dto.cookComment,
        riderComment: dto.riderComment,
      },
    });

    // Recalculer les notes moyennes
    await Promise.all([
      this.recalcCookRating(order.cookId),
      order.riderId ? this.recalcRiderRating(order.riderId) : Promise.resolve(),
    ]);

    return review;
  }

  private async recalcCookRating(cookUserId: string) {
    const cookProfile = await this.prisma.cookProfile.findUnique({
      where: { userId: cookUserId },
    });
    if (!cookProfile) return;

    const reviews = await this.prisma.review.findMany({
      where: {
        order: { cookId: cookUserId },
        cookRating: { not: null },
      },
      select: { cookRating: true },
    });

    if (reviews.length === 0) return;
    const avg =
      reviews.reduce((s, r) => s + (r.cookRating ?? 0), 0) / reviews.length;

    await this.prisma.cookProfile.update({
      where: { id: cookProfile.id },
      data: { avgRating: Math.round(avg * 10) / 10 },
    });
  }

  private async recalcRiderRating(riderUserId: string) {
    const riderProfile = await this.prisma.riderProfile.findUnique({
      where: { userId: riderUserId },
    });
    if (!riderProfile) return;

    const reviews = await this.prisma.review.findMany({
      where: {
        order: { riderId: riderUserId },
        riderRating: { not: null },
      },
      select: { riderRating: true },
    });

    if (reviews.length === 0) return;
    const avg =
      reviews.reduce((s, r) => s + (r.riderRating ?? 0), 0) / reviews.length;

    await this.prisma.riderProfile.update({
      where: { id: riderProfile.id },
      data: { avgRating: Math.round(avg * 10) / 10 },
    });
  }
}
