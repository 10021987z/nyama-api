import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class BroadcastRidersDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  message!: string;

  @IsOptional()
  @IsString()
  quarterId?: string;
}
