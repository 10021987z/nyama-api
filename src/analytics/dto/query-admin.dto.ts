import { IsOptional, IsEnum, IsString, IsDateString, IsInt, IsIn, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { UserRole, OrderStatus, DeliveryStatus, VehicleType } from '@prisma/client';

export class QueryAdminUsersDto {
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class QueryAdminOrdersDto {
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class QueryAdminRestaurantsDto {
  @IsOptional()
  @IsString()
  quarter_id?: string;

  @IsOptional()
  @IsIn(['OUVERT', 'FERMÉ', 'EN_ATTENTE'])
  status?: 'OUVERT' | 'FERMÉ' | 'EN_ATTENTE';

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class QueryAdminDeliveriesDto {
  @IsOptional()
  @IsEnum(DeliveryStatus)
  status?: DeliveryStatus;

  @IsOptional()
  @IsString()
  rider_id?: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class QueryAdminRevenueDto {
  @IsOptional()
  @IsIn(['7d', '30d', 'year'])
  period?: '7d' | '30d' | 'year';
}

export class QueryAdminFleetDto {
  @IsOptional()
  @IsIn(['EN_LIVRAISON', 'EN_LIGNE', 'HORS_LIGNE'])
  status?: 'EN_LIVRAISON' | 'EN_LIGNE' | 'HORS_LIGNE';

  @IsOptional()
  @IsEnum(VehicleType)
  vehicle_type?: VehicleType;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
