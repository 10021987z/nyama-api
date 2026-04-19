import { IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class PostRiderLocationDto {
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  lng: number;

  @IsOptional()
  @IsString()
  orderId?: string;
}
