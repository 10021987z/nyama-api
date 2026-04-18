import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class SetAvailabilityDto {
  @IsBoolean()
  available: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  reason?: string;
}
