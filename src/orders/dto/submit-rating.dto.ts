import {
  IsInt,
  IsOptional,
  IsString,
  IsArray,
  Min,
  Max,
  MaxLength,
  ArrayMaxSize,
} from 'class-validator';

/**
 * POST /orders/:id/rating — body.
 *
 * 3 notes obligatoires post-livraison :
 *  - riderStars      : note du livreur
 *  - restaurantStars : note du plat/cuisinière
 *  - appStars        : note de l'app NYAMA
 *
 * `comment` et `tags` (rapide, sympathique, etc.) sont optionnels.
 */
export class SubmitRatingDto {
  @IsInt()
  @Min(1)
  @Max(5)
  riderStars: number;

  @IsInt()
  @Min(1)
  @Max(5)
  restaurantStars: number;

  @IsInt()
  @Min(1)
  @Max(5)
  appStars: number;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  comment?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  tags?: string[];
}
