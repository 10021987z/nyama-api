import { IsString, IsOptional, IsIn } from 'class-validator';

export class UpdatePartnershipDto {
  @IsOptional()
  @IsIn(['pending', 'under_review', 'approved', 'rejected'])
  status?: string;

  @IsOptional()
  @IsString()
  adminNotes?: string;
}
