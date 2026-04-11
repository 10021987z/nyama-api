import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { DisputeSeverity, DisputeType } from '@prisma/client';

export class CreateDisputeDto {
  @IsString()
  orderId!: string;

  @IsEnum(DisputeType)
  type!: DisputeType;

  @IsOptional()
  @IsEnum(DisputeSeverity)
  severity?: DisputeSeverity;

  @IsString()
  @MinLength(10)
  description!: string;

  /** JSON array d'URLs — envoyé sérialisé depuis le client */
  @IsOptional()
  @IsString()
  evidence?: string;

  @IsOptional()
  @IsInt()
  refundAmountXaf?: number;
}
