import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ApplicationStatus,
  PartnerType,
  Prisma,
  UserRole,
  VehicleType,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateApplicationDto } from './dto/create-application.dto';
import { QueryApplicationsDto } from './dto/query-applications.dto';
import {
  ApproveApplicationDto,
  RejectApplicationDto,
} from './dto/review-application.dto';

@Injectable()
export class PartnersService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Create (self-service from apps) ───────────────────────────────
  async create(userId: string, dto: CreateApplicationDto) {
    // Prevent duplicate pending applications of the same type
    const existing = await this.prisma.partnerApplication.findFirst({
      where: {
        userId,
        type: dto.type,
        status: {
          in: [ApplicationStatus.PENDING, ApplicationStatus.UNDER_REVIEW],
        },
      },
    });
    if (existing) {
      throw new BadRequestException(
        'Vous avez déjà une candidature en cours pour ce type',
      );
    }

    return this.prisma.partnerApplication.create({
      data: {
        userId,
        type: dto.type,
        fullName: dto.fullName,
        phone: dto.phone,
        email: dto.email,
        idNumber: dto.idNumber,
        idDocumentUrl: dto.idDocumentUrl,
        selfieUrl: dto.selfieUrl,
        specialties: dto.specialties,
        cookingExp: dto.cookingExp,
        kitchenPhotos: dto.kitchenPhotos,
        healthCertUrl: dto.healthCertUrl,
        vehicleType: dto.vehicleType,
        plateNumber: dto.plateNumber,
        licenseUrl: dto.licenseUrl,
        insuranceUrl: dto.insuranceUrl,
        vehiclePhotos: dto.vehiclePhotos,
        score: dto.score,
      },
    });
  }

  // ── Admin list + stats ────────────────────────────────────────────
  async findAll(query: QueryApplicationsDto) {
    const { type, status, search } = query;
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const where: Prisma.PartnerApplicationWhereInput = {
      ...(type && { type }),
      ...(status && { status }),
      ...(search && {
        OR: [
          { fullName: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search } },
          { email: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [items, total] = await Promise.all([
      this.prisma.partnerApplication.findMany({
        where,
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
        include: {
          user: { select: { id: true, phone: true, email: true, role: true } },
        },
      }),
      this.prisma.partnerApplication.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getStats() {
    const [pending, underReview, approved, rejected, cookCount, riderCount] =
      await Promise.all([
        this.prisma.partnerApplication.count({
          where: { status: ApplicationStatus.PENDING },
        }),
        this.prisma.partnerApplication.count({
          where: { status: ApplicationStatus.UNDER_REVIEW },
        }),
        this.prisma.partnerApplication.count({
          where: { status: ApplicationStatus.APPROVED },
        }),
        this.prisma.partnerApplication.count({
          where: { status: ApplicationStatus.REJECTED },
        }),
        this.prisma.partnerApplication.count({
          where: { type: PartnerType.COOK, status: ApplicationStatus.PENDING },
        }),
        this.prisma.partnerApplication.count({
          where: { type: PartnerType.RIDER, status: ApplicationStatus.PENDING },
        }),
      ]);
    return {
      pending,
      underReview,
      approved,
      rejected,
      pendingCooks: cookCount,
      pendingRiders: riderCount,
    };
  }

  async findOne(id: string) {
    const app = await this.prisma.partnerApplication.findUnique({
      where: { id },
      include: {
        user: {
          select: { id: true, phone: true, email: true, name: true, role: true },
        },
      },
    });
    if (!app) throw new NotFoundException('Candidature introuvable');
    return app;
  }

  async findMine(userId: string) {
    return this.prisma.partnerApplication.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ── Approve ───────────────────────────────────────────────────────
  async approve(id: string, adminId: string, dto: ApproveApplicationDto) {
    const app = await this.findOne(id);
    if (app.status === ApplicationStatus.APPROVED) {
      throw new BadRequestException('Candidature déjà approuvée');
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.partnerApplication.update({
        where: { id },
        data: {
          status: ApplicationStatus.APPROVED,
          reviewedBy: adminId,
          reviewedAt: new Date(),
          notes: dto.notes ?? app.notes,
          score: dto.score ?? app.score,
        },
      });

      if (app.type === PartnerType.COOK) {
        // Flip user role
        await tx.user.update({
          where: { id: app.userId },
          data: { role: UserRole.COOK },
        });

        // Create CookProfile only if approval payload has the required geo
        // info (quarterId + lat/lng). Otherwise the cook completes setup
        // from the cook app.
        const existing = await tx.cookProfile.findUnique({
          where: { userId: app.userId },
        });
        if (!existing && dto.quarterId && dto.locationLat && dto.locationLng) {
          await tx.cookProfile.create({
            data: {
              userId: app.userId,
              displayName: dto.displayName ?? app.fullName,
              specialty: app.specialties ?? '[]',
              quarterId: dto.quarterId,
              locationLat: dto.locationLat,
              locationLng: dto.locationLng,
              isVerified: true,
              isActive: true,
            },
          });
        } else if (existing) {
          await tx.cookProfile.update({
            where: { userId: app.userId },
            data: { isVerified: true, isActive: true },
          });
        }
      } else if (app.type === PartnerType.RIDER) {
        await tx.user.update({
          where: { id: app.userId },
          data: { role: UserRole.RIDER },
        });

        const existing = await tx.riderProfile.findUnique({
          where: { userId: app.userId },
        });
        const vt = (app.vehicleType ?? 'MOTO') as VehicleType;
        if (!existing) {
          await tx.riderProfile.create({
            data: {
              userId: app.userId,
              vehicleType: Object.values(VehicleType).includes(vt)
                ? vt
                : VehicleType.MOTO,
              plateNumber: app.plateNumber,
              isVerified: true,
            },
          });
        } else {
          await tx.riderProfile.update({
            where: { userId: app.userId },
            data: { isVerified: true },
          });
        }
      }

      return updated;
    });
  }

  // ── Reject ────────────────────────────────────────────────────────
  async reject(id: string, adminId: string, dto: RejectApplicationDto) {
    const app = await this.findOne(id);
    if (app.status === ApplicationStatus.REJECTED) {
      throw new BadRequestException('Candidature déjà rejetée');
    }
    return this.prisma.partnerApplication.update({
      where: { id },
      data: {
        status: ApplicationStatus.REJECTED,
        reviewedBy: adminId,
        reviewedAt: new Date(),
        rejectionReason: dto.rejectionReason,
        notes: dto.notes ?? app.notes,
      },
    });
  }

  // ── Mark under review ─────────────────────────────────────────────
  async markUnderReview(id: string, adminId: string) {
    await this.findOne(id);
    return this.prisma.partnerApplication.update({
      where: { id },
      data: {
        status: ApplicationStatus.UNDER_REVIEW,
        reviewedBy: adminId,
      },
    });
  }

  // ── Suspend (already approved partner) ────────────────────────────
  async suspend(id: string, adminId: string, reason?: string) {
    const app = await this.findOne(id);
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.partnerApplication.update({
        where: { id },
        data: {
          status: ApplicationStatus.SUSPENDED,
          reviewedBy: adminId,
          reviewedAt: new Date(),
          rejectionReason: reason ?? app.rejectionReason,
        },
      });
      if (app.type === PartnerType.COOK) {
        await tx.cookProfile.updateMany({
          where: { userId: app.userId },
          data: { isActive: false },
        });
      } else if (app.type === PartnerType.RIDER) {
        await tx.riderProfile.updateMany({
          where: { userId: app.userId },
          data: { isVerified: false, isOnline: false },
        });
      }
      return updated;
    });
  }
}
