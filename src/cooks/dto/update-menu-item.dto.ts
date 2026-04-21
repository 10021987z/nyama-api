import { IsString, IsInt, IsOptional, Min, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateMenuItemDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(100)
  priceXaf?: number;

  @IsOptional()
  @IsString()
  category?: string;

  // Peut être une URL http(s) ou un chemin relatif type /uploads/<id>.jpg.
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean;

  @IsOptional()
  @IsBoolean()
  isDailySpecial?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  prepTimeMin?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  stockRemaining?: number;
}
