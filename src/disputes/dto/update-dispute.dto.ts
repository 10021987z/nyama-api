import { IsEnum, IsInt, IsOptional, IsString } from 'class-validator';
import { DisputeSeverity, DisputeStatus } from '@prisma/client';

export class UpdateDisputeDto {
  @IsOptional()
  @IsEnum(DisputeStatus)
  status?: DisputeStatus;

  @IsOptional()
  @IsEnum(DisputeSeverity)
  severity?: DisputeSeverity;

  @IsOptional()
  @IsString()
  assignedTo?: string;

  @IsOptional()
  @IsString()
  resolution?: string;

  @IsOptional()
  @IsInt()
  refundAmountXaf?: number;
}

export class AddDisputeMessageDto {
  @IsString()
  message!: string;

  /** CLIENT | COOK | RIDER | ADMIN — inféré côté service si non fourni */
  @IsOptional()
  @IsString()
  authorRole?: string;
}
