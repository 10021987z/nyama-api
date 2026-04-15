import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { Prisma, UserRole, VehicleType } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../notifications/email.service';
import { WhatsappService } from '../notifications/whatsapp.service';
import { CreatePartnershipDto } from './dto/create-partnership.dto';
import { UpdatePartnershipDto } from './dto/update-partnership.dto';
import { QueryPartnershipsDto } from './dto/query-partnerships.dto';

const ACCESS_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

@Injectable()
export class PartnershipsService {
  private readonly logger = new Logger(PartnershipsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    private readonly whatsapp: WhatsappService,
  ) {}

  async create(dto: CreatePartnershipDto) {
    const created = await this.prisma.partnershipRequest.create({
      data: {
        type: dto.type,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        email: dto.email,
        companyName: dto.companyName,
        description: dto.description,
        city: dto.city,
        quarter: dto.quarter,
        vehicleType: dto.vehicleType,
        idNumber: dto.idNumber,
      },
    });

    this.email.sendApplicationReceivedEmail(
      created.email,
      `${created.firstName} ${created.lastName}`,
    );

    this.whatsapp.sendApplicationReceived(
      created.phone,
      created.firstName,
      created.id,
    );

    return created;
  }

  async findAll(query: QueryPartnershipsDto) {
    const { status, type, search } = query;
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;

    const where: Prisma.PartnershipRequestWhereInput = {
      ...(status && { status }),
      ...(type && { type }),
      ...(search && {
        OR: [
          { firstName: { contains: search, mode: 'insensitive' as const } },
          { lastName: { contains: search, mode: 'insensitive' as const } },
          { phone: { contains: search } },
          { email: { contains: search, mode: 'insensitive' as const } },
          { companyName: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
    };

    const [items, total] = await Promise.all([
      this.prisma.partnershipRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.partnershipRequest.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string) {
    const request = await this.prisma.partnershipRequest.findUnique({
      where: { id },
    });
    if (!request) throw new NotFoundException('Candidature introuvable');
    return request;
  }

  async update(id: string, dto: UpdatePartnershipDto, adminId: string) {
    const existing = await this.prisma.partnershipRequest.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException('Candidature introuvable');

    if (dto.status === 'approved') {
      return this.approve(existing.id, adminId, dto.adminNotes);
    }

    if (dto.status === 'rejected') {
      if (!dto.adminNotes || !dto.adminNotes.trim()) {
        throw new BadRequestException(
          'La raison du rejet (adminNotes) est obligatoire',
        );
      }
      return this.reject(existing.id, adminId, dto.adminNotes);
    }

    return this.prisma.partnershipRequest.update({
      where: { id },
      data: {
        ...(dto.status && { status: dto.status }),
        ...(dto.adminNotes !== undefined && { adminNotes: dto.adminNotes }),
        reviewedBy: adminId,
        reviewedAt: new Date(),
      },
    });
  }

  async approve(id: string, adminId: string, adminNotes?: string) {
    try {
      const application = await this.prisma.partnershipRequest.findUnique({
        where: { id },
      });
      if (!application) throw new NotFoundException('Candidature introuvable');
      if (application.status === 'approved') {
        throw new ConflictException('Candidature déjà approuvée');
      }

      const role: UserRole =
        application.type === 'cuisiniere' ? UserRole.COOK : UserRole.RIDER;

      const accessCode = this.generateAccessCode();
      const accessCodeHash = await bcrypt.hash(accessCode, 10);

      const fullName = `${application.firstName} ${application.lastName}`.trim();

      const result = await this.prisma.$transaction(async (tx) => {
        const existingByPhone = await tx.user.findUnique({
          where: { phone: application.phone },
        });
        const existingByEmail = application.email
          ? await tx.user.findUnique({
              where: { email: application.email },
            })
          : null;

        // Re-use the account matched by phone first (it's the partner's
        // account). If the email on the application belongs to a
        // different user, we must not overwrite it — unique constraint.
        const reused = existingByPhone ?? existingByEmail;
        const emailTakenByOther =
          !!existingByEmail &&
          (!reused || existingByEmail.id !== reused.id) &&
          existingByEmail.id !== existingByPhone?.id;

        const user = reused
          ? await tx.user.update({
              where: { id: reused.id },
              data: {
                name: reused.name ?? fullName,
                // Only touch email if no conflict with another account.
                email:
                  reused.email ??
                  (emailTakenByOther
                    ? undefined
                    : (application.email ?? undefined)),
                role,
                firstLoginCode: accessCodeHash,
                firstLoginUsed: false,
              },
            })
          : await tx.user.create({
              data: {
                phone: application.phone,
                email: emailTakenByOther
                  ? undefined
                  : (application.email ?? undefined),
                name: fullName,
                role,
                firstLoginCode: accessCodeHash,
                firstLoginUsed: false,
              },
            });

        if (role === UserRole.COOK) {
          let quarter = await tx.quarter.findFirst({
            where: {
              name: { equals: application.quarter, mode: 'insensitive' },
              city: { equals: application.city, mode: 'insensitive' },
            },
          });
          if (!quarter) {
            quarter = await tx.quarter.create({
              data: {
                id: this.makeQuarterId(application.city, application.quarter),
                name: application.quarter,
                city: application.city,
                polygon: JSON.stringify({ type: 'Polygon', coordinates: [] }),
                isActive: true,
              },
            });
          }

          const specialty = JSON.stringify(
            application.description ? [application.description] : [],
          );

          await tx.cookProfile.upsert({
            where: { userId: user.id },
            update: {
              displayName: application.companyName || fullName,
              specialty,
              description: application.description ?? undefined,
              quarterId: quarter.id,
              isVerified: true,
              isActive: true,
              momoPhone: application.phone,
            },
            create: {
              userId: user.id,
              displayName: application.companyName || fullName,
              specialty,
              description: application.description ?? undefined,
              quarterId: quarter.id,
              locationLat: 0,
              locationLng: 0,
              isVerified: true,
              isActive: true,
              momoPhone: application.phone,
            },
          });
        } else {
          const vehicle = this.parseVehicleType(application.vehicleType);
          await tx.riderProfile.upsert({
            where: { userId: user.id },
            update: {
              vehicleType: vehicle,
              isVerified: true,
              momoPhone: application.phone,
            },
            create: {
              userId: user.id,
              vehicleType: vehicle,
              isVerified: true,
              isOnline: false,
              momoPhone: application.phone,
            },
          });
        }

        const updated = await tx.partnershipRequest.update({
          where: { id },
          data: {
            status: 'approved',
            accessCodeHash,
            adminNotes: adminNotes ?? application.adminNotes,
            reviewedBy: adminId,
            reviewedAt: new Date(),
          },
        });

        return { user, application: updated };
      });

      this.email.sendPartnerApprovalEmail(
        application.email,
        fullName,
        accessCode,
        application.type,
      );

      const whatsappLink = this.whatsapp.sendApproval(
        application.phone,
        application.firstName,
        accessCode,
        application.type,
      );

      return {
        application: result.application,
        user: {
          id: result.user.id,
          phone: result.user.phone,
          email: result.user.email,
          name: result.user.name,
          role: result.user.role,
        },
        accessCode,
        whatsappLink,
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ConflictException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      const err = error as Error;
      this.logger.error(
        `Erreur approbation partenaire ${id}: ${err.message}`,
        err.stack,
      );
      throw new InternalServerErrorException(
        `Impossible d'approuver: ${err.message}`,
      );
    }
  }

  async reject(id: string, adminId: string, reason: string) {
    const application = await this.prisma.partnershipRequest.findUnique({
      where: { id },
    });
    if (!application) throw new NotFoundException('Candidature introuvable');

    const updated = await this.prisma.partnershipRequest.update({
      where: { id },
      data: {
        status: 'rejected',
        adminNotes: reason,
        reviewedBy: adminId,
        reviewedAt: new Date(),
      },
    });

    this.email.sendPartnerRejectionEmail(
      application.email,
      `${application.firstName} ${application.lastName}`.trim(),
      reason,
    );

    this.whatsapp.sendRejection(
      application.phone,
      application.firstName,
      reason,
    );

    return updated;
  }

  async getStats() {
    const [total, pending, approved, rejected] = await Promise.all([
      this.prisma.partnershipRequest.count(),
      this.prisma.partnershipRequest.count({ where: { status: 'pending' } }),
      this.prisma.partnershipRequest.count({ where: { status: 'approved' } }),
      this.prisma.partnershipRequest.count({ where: { status: 'rejected' } }),
    ]);

    return { total, pending, approved, rejected };
  }

  private generateAccessCode(): string {
    const bytes = crypto.randomBytes(4);
    let code = '';
    for (let i = 0; i < 4; i++) {
      code += ACCESS_CODE_ALPHABET[bytes[i] % ACCESS_CODE_ALPHABET.length];
    }
    return `NYAM-${code}`;
  }

  private makeQuarterId(city: string, quarter: string): string {
    const slug = (s: string) =>
      s
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    return `q-${slug(city)}-${slug(quarter)}`;
  }

  private parseVehicleType(raw?: string | null): VehicleType {
    const v = (raw ?? '').toLowerCase();
    if (v.startsWith('velo') || v.startsWith('vélo')) return VehicleType.VELO;
    if (v.startsWith('voiture') || v === 'car') return VehicleType.VOITURE;
    return VehicleType.MOTO;
  }
}
