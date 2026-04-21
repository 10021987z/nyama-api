import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class SuggestMenuDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  dishKeywords: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  cuisineContext?: string;
}
