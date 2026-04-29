import {
  IsArray,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/**
 * Body envoyé par l'app Pro (`PATCH /cook/profile`) — voir
 * nyama_pro/lib/features/profile/screens/restaurant_presentation_screen.dart.
 *
 * `specialty` arrive comme List<string> côté app, sérialisé en JSON string
 * pour respecter le schema actuel de CookProfile.specialty.
 * `openingHours` arrive comme Map (par jour), sérialisé en JSON string aussi.
 */
export class UpdateCookProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  displayName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  landmark?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  specialty?: string[];

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(240)
  prepTimeAvgMin?: number;

  @IsOptional()
  @IsObject()
  openingHours?: Record<string, unknown>;
}
