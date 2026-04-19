import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdateRiderProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(32)
  plateNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  vehicleBrand?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1980)
  vehicleYear?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  vehicleKm?: number;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  insuranceNumber?: string;

  @IsOptional()
  @IsDateString()
  insuranceExpiry?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  licenseNumber?: string;

  @IsOptional()
  @IsDateString()
  licenseExpiry?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  iban?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  momoPhone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  momoProvider?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  address?: string;
}
