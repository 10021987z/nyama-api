import { IsOptional, IsString, IsIn, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class QueryCooksDto {
  @IsOptional()
  @IsString()
  quarter_id?: string;

  @IsOptional()
  @IsIn(['Douala', 'Yaoundé'])
  city?: string;

  @IsOptional()
  @IsIn(['rating', 'totalOrders', 'displayName'])
  sort?: 'rating' | 'totalOrders' | 'displayName';

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
