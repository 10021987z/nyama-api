import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { TicketCategory, TicketPriority } from '@prisma/client';

export class CreateTicketDto {
  @IsEnum(TicketCategory)
  category!: TicketCategory;

  @IsString()
  @MinLength(3)
  subject!: string;

  @IsString()
  @MinLength(5)
  message!: string;

  @IsOptional()
  @IsEnum(TicketPriority)
  priority?: TicketPriority;

  @IsOptional()
  @IsString()
  contactPhone?: string;

  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @IsOptional()
  @IsString()
  orderId?: string;

  /** JSON array d'URLs */
  @IsOptional()
  @IsString()
  attachments?: string;

  /** CLIENT | COOK | RIDER | GUEST — optional, inferred from JWT role */
  @IsOptional()
  @IsString()
  reporterRole?: string;
}
