import {
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { PartnerType } from '@prisma/client';

export class CreateApplicationDto {
  @IsEnum(PartnerType)
  type!: PartnerType;

  @IsString()
  @MinLength(2)
  fullName!: string;

  @IsString()
  phone!: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  idNumber?: string;

  @IsOptional()
  @IsString()
  idDocumentUrl?: string;

  @IsOptional()
  @IsString()
  selfieUrl?: string;

  // Cook fields (JSON-serialized arrays where applicable)
  @IsOptional()
  @IsString()
  specialties?: string;

  @IsOptional()
  @IsString()
  cookingExp?: string;

  @IsOptional()
  @IsString()
  kitchenPhotos?: string;

  @IsOptional()
  @IsString()
  healthCertUrl?: string;

  // Rider fields
  @IsOptional()
  @IsString()
  vehicleType?: string;

  @IsOptional()
  @IsString()
  plateNumber?: string;

  @IsOptional()
  @IsString()
  licenseUrl?: string;

  @IsOptional()
  @IsString()
  insuranceUrl?: string;

  @IsOptional()
  @IsString()
  vehiclePhotos?: string;

  @IsOptional()
  @IsInt()
  score?: number;
}
