import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export enum CampaignSegment {
  VIP = 'vip',
  AT_RISK = 'atRisk',
  LOST = 'lost',
  ALL = 'all',
}

export enum CampaignChannel {
  EMAIL = 'email',
  SMS = 'sms',
}

export class CreateCampaignDto {
  @IsEnum(CampaignSegment)
  segment!: CampaignSegment;

  @IsEnum(CampaignChannel)
  channel!: CampaignChannel;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  subject?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  body!: string;
}
