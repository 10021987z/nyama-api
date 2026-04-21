import { IsEnum, IsIn, IsInt, IsOptional, IsString, Max, Min, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';
import { OrderStatus, UserRole } from '@prisma/client';

export class QueryAdminUsersLiveDto {
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @IsOptional()
  @IsString()
  status?: string; // "online" | "offline" | "suspended" | any

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  sortBy?: string; // "createdAt" | "name" | "lastSeenAt" | "totalOrders"

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => String)
  onlineOnly?: string; // "true" / "false"
}

export class PatchAdminUserDto {
  @IsIn(['suspend', 'reactivate', 'force_reconnect'])
  action!: 'suspend' | 'reactivate' | 'force_reconnect';

  @IsOptional()
  @IsString()
  reason?: string;
}

export class InterveneOrderDto {
  @IsIn(['force_cancel', 'reassign_rider', 'extend_deadline', 'refund', 'notify_all'])
  action!:
    | 'force_cancel'
    | 'reassign_rider'
    | 'extend_deadline'
    | 'refund'
    | 'notify_all';

  @IsString()
  reason!: string;

  @IsOptional()
  payload?: Record<string, unknown>;
}

export class QueryCustomReportDto {
  @IsDateString()
  from!: string;

  @IsDateString()
  to!: string;

  @IsIn(['pdf', 'excel', 'csv'])
  format!: 'pdf' | 'excel' | 'csv';

  @IsOptional()
  @IsString()
  restaurantId?: string;

  @IsOptional()
  @IsString()
  riderId?: string;

  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;
}
