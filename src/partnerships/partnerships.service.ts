import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePartnershipDto } from './dto/create-partnership.dto';
import { UpdatePartnershipDto } from './dto/update-partnership.dto';
import { QueryPartnershipsDto } from './dto/query-partnerships.dto';

@Injectable()
export class PartnershipsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreatePartnershipDto) {
    return this.prisma.partnershipRequest.create({
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

  async getStats() {
    const [total, pending, approved, rejected] = await Promise.all([
      this.prisma.partnershipRequest.count(),
      this.prisma.partnershipRequest.count({ where: { status: 'pending' } }),
      this.prisma.partnershipRequest.count({ where: { status: 'approved' } }),
      this.prisma.partnershipRequest.count({ where: { status: 'rejected' } }),
    ]);

    return { total, pending, approved, rejected };
  }
}
