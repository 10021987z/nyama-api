import { IsOptional, IsEnum, IsDateString } from 'class-validator';
import { OrderStatus } from '@prisma/client';

export class QueryCookOrdersDto {
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @IsOptional()
  @IsDateString()
  date?: string;
}
