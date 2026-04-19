import { IsBoolean, IsNumber, IsOptional } from 'class-validator';

export class UpdateRiderStatusDto {
  @IsBoolean()
  online: boolean;

  @IsOptional()
  @IsNumber()
  locationLat?: number;

  @IsOptional()
  @IsNumber()
  locationLng?: number;
}
