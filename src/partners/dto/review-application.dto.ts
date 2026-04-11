import {
  IsInt,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ApproveApplicationDto {
  // Cook approval — location & quarter required to create CookProfile
  @IsOptional()
  @IsString()
  quarterId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsLatitude()
  locationLat?: number;

  @IsOptional()
  @Type(() => Number)
  @IsLongitude()
  locationLng?: number;

  @IsOptional()
  @IsString()
  displayName?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsInt()
  score?: number;
}

export class RejectApplicationDto {
  @IsString()
  @MinLength(5)
  rejectionReason!: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
