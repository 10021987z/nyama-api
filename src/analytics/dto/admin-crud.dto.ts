import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';
import { SubscriptionPlan, UserRole, VehicleType } from '@prisma/client';

// ─────────────────────────────────────────────────────────────
// POST /admin/users
// ─────────────────────────────────────────────────────────────
export class CreateAdminUserDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @Matches(/^\+237\d{9}$/, {
    message: 'phone must be in format +237XXXXXXXXX',
  })
  phone!: string;

  @IsEnum(UserRole)
  role!: UserRole;
}

// ─────────────────────────────────────────────────────────────
// POST /admin/restaurants
// ─────────────────────────────────────────────────────────────
export class CreateAdminRestaurantDto {
  @IsString()
  userId!: string;

  @IsString()
  @MinLength(2)
  displayName!: string;

  @IsArray()
  @IsString({ each: true })
  specialty!: string[];

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  quarterId!: string;

  @IsOptional()
  @IsString()
  momoPhone?: string;

  @IsOptional()
  @IsIn(['mtn', 'orange'])
  momoProvider?: 'mtn' | 'orange';

  @IsLatitude()
  locationLat!: number;

  @IsLongitude()
  locationLng!: number;

  @IsOptional()
  @IsString()
  landmark?: string;
}

// ─────────────────────────────────────────────────────────────
// PATCH /admin/restaurants/:id
// ─────────────────────────────────────────────────────────────
export class UpdateAdminRestaurantDto {
  @IsOptional()
  @IsBoolean()
  isVerified?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsEnum(SubscriptionPlan)
  subscriptionPlan?: SubscriptionPlan;
}

// ─────────────────────────────────────────────────────────────
// POST /admin/fleet
// ─────────────────────────────────────────────────────────────
export class CreateAdminFleetDto {
  @IsString()
  userId!: string;

  @IsEnum(VehicleType)
  vehicleType!: VehicleType;

  @IsOptional()
  @IsString()
  plateNumber?: string;

  @IsOptional()
  @IsString()
  momoPhone?: string;

  @IsOptional()
  @IsIn(['mtn', 'orange'])
  momoProvider?: 'mtn' | 'orange';
}

// ─────────────────────────────────────────────────────────────
// PATCH /admin/fleet/:id
// ─────────────────────────────────────────────────────────────
export class UpdateAdminFleetDto {
  @IsOptional()
  @IsBoolean()
  isVerified?: boolean;

  // status is mapped: "SUSPENDED" → isVerified=false, "ACTIVE" → isVerified=true
  @IsOptional()
  @IsIn(['ACTIVE', 'SUSPENDED'])
  status?: 'ACTIVE' | 'SUSPENDED';
}
