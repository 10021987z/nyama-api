import { IsOptional, IsIn } from 'class-validator';

export class QueryEarningsDto {
  @IsOptional()
  @IsIn(['today', 'week', 'month'])
  period?: 'today' | 'week' | 'month';
}
