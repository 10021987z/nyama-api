import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma, UserRole, VehicleType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { paginationParams, paginatedResult } from '../common/pagination.helper';
import {
  ApplyRiderDto,
  UpdateApplicationStatusDto,
  QueryApplicationsDto,
} from './dto/apply.dto';

@Injectable()
export class OnboardingService {
  constructor(private readonly prisma: PrismaService) {}

  private computeKycScore(dto: ApplyRiderDto): number {
    let score = 0;
    if (dto.selfiePhoto) score += 20;
    if (dto.cniPhoto) score += 25;
    if (dto.permisPhoto) score += 25;
    if (dto.vehiclePhoto) score += 15;
    if (dto.phone && dto.phone.length >= 9) score += 5;
    if (dto.fullName && dto.fullName.length > 3) score += 5;
    if (dto.emergencyContact) score += 5;
    return score;
  }

  private resolveStatus(score: number): string {
    if (score >= 80) return 'pre_approved';
    if (score >= 50) return 'pending';
    return 'rejected';
  }

  async apply(dto: ApplyRiderDto) {
    const kycScore = this.computeKycScore(dto);
    const status = this.resolveStatus(kycScore);

    const application = await this.prisma.riderApplication.create({
      data: {
        fullName: dto.fullName,
        phone: dto.phone,
        email: dto.email,
        dateOfBirth: dto.dateOfBirth,
        city: dto.city,
        quarter: dto.quarter,
        vehicleType: dto.vehicleType ?? 'moto',
        vehicleBrand: dto.vehicleBrand,
        vehicleColor: dto.vehicleColor,
        plateNumber: dto.plateNumber,
        orangeMoney: dto.orangeMoney,
        mtnMomo: dto.mtnMomo,
        emergencyContact: dto.emergencyContact,
        emergencyPhone: dto.emergencyPhone,
        selfiePhotoUrl: dto.selfiePhoto,
        cniPhotoUrl: dto.cniPhoto,
        permisPhotoUrl: dto.permisPhoto,
        vehiclePhotoUrl: dto.vehiclePhoto,
        kycScore,
        status,
      },
    });

    return { success: true, application };
  }

  async getStatus(id: string) {
    const app = await this.prisma.riderApplication.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        kycScore: true,
        reviewedBy: true,
        reviewedAt: true,
      },
    });
    if (!app) throw new NotFoundException('Candidature introuvable');
    return app;
  }

  async findAll(query: QueryApplicationsDto) {
    const page = query.page ? parseInt(query.page, 10) : 1;
    const limit = query.limit ? parseInt(query.limit, 10) : 20;
    const { skip, take } = paginationParams(page, limit);

    const where: Prisma.RiderApplicationWhereInput = {};
    if (query.status) where.status = query.status;

    const [total, data] = await Promise.all([
      this.prisma.riderApplication.count({ where }),
      this.prisma.riderApplication.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return paginatedResult(data, total, page, limit);
  }

  async findOne(id: string) {
    const app = await this.prisma.riderApplication.findUnique({ where: { id } });
    if (!app) throw new NotFoundException('Candidature introuvable');
    return app;
  }

  async updateStatus(id: string, dto: UpdateApplicationStatusDto) {
    const app = await this.prisma.riderApplication.findUnique({ where: { id } });
    if (!app) throw new NotFoundException('Candidature introuvable');

    const updated = await this.prisma.riderApplication.update({
      where: { id },
      data: {
        status: dto.status,
        reviewedBy: dto.reviewedBy,
        reviewedAt: new Date(),
      },
    });

    if (dto.status === 'approved') {
      await this.promoteToRider(updated);
    }

    return updated;
  }

  private mapVehicleType(value?: string | null): VehicleType {
    switch ((value ?? 'moto').toLowerCase()) {
      case 'velo':
        return VehicleType.VELO;
      case 'voiture':
        return VehicleType.VOITURE;
      case 'moto':
      default:
        return VehicleType.MOTO;
    }
  }

  private async promoteToRider(app: {
    id: string;
    fullName: string;
    phone: string;
    email: string | null;
    vehicleType: string;
    plateNumber: string | null;
    orangeMoney: string | null;
    mtnMomo: string | null;
  }) {
    const existing = await this.prisma.user.findUnique({
      where: { phone: app.phone },
      include: { riderProfile: true },
    });

    if (existing?.riderProfile) {
      return existing;
    }

    const momoPhone = app.orangeMoney ?? app.mtnMomo ?? null;
    const momoProvider = app.orangeMoney
      ? 'orange'
      : app.mtnMomo
      ? 'mtn'
      : null;

    if (existing) {
      await this.prisma.user.update({
        where: { id: existing.id },
        data: {
          role: UserRole.RIDER,
          name: existing.name ?? app.fullName,
          email: existing.email ?? app.email ?? undefined,
          riderProfile: {
            create: {
              vehicleType: this.mapVehicleType(app.vehicleType),
              plateNumber: app.plateNumber,
              momoPhone,
              momoProvider,
              isVerified: true,
            },
          },
        },
      });
      return;
    }

    try {
      await this.prisma.user.create({
        data: {
          phone: app.phone,
          email: app.email ?? undefined,
          name: app.fullName,
          role: UserRole.RIDER,
          riderProfile: {
            create: {
              vehicleType: this.mapVehicleType(app.vehicleType),
              plateNumber: app.plateNumber,
              momoPhone,
              momoProvider,
              isVerified: true,
            },
          },
        },
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new BadRequestException(
          'Un utilisateur avec ce téléphone existe déjà',
        );
      }
      throw err;
    }
  }

  async getStats() {
    const [total, pending, preApproved, approved, rejected] = await Promise.all([
      this.prisma.riderApplication.count(),
      this.prisma.riderApplication.count({ where: { status: 'pending' } }),
      this.prisma.riderApplication.count({ where: { status: 'pre_approved' } }),
      this.prisma.riderApplication.count({ where: { status: 'approved' } }),
      this.prisma.riderApplication.count({ where: { status: 'rejected' } }),
    ]);
    return { total, pending, preApproved, approved, rejected };
  }
}
