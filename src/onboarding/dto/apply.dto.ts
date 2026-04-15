import { IsString, IsOptional, IsEmail, IsIn, MinLength } from 'class-validator';

export class ApplyRiderDto {
  @IsString()
  @MinLength(1)
  fullName: string;

  @IsString()
  phone: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsString()
  dateOfBirth: string;

  @IsString()
  city: string;

  @IsString()
  quarter: string;

  @IsOptional()
  @IsIn(['moto', 'velo', 'voiture', 'a_pied'])
  vehicleType?: string;

  @IsOptional()
  @IsString()
  vehicleBrand?: string;

  @IsOptional()
  @IsString()
  vehicleColor?: string;

  @IsOptional()
  @IsString()
  plateNumber?: string;

  @IsOptional()
  @IsString()
  orangeMoney?: string;

  @IsOptional()
  @IsString()
  mtnMomo?: string;

  @IsOptional()
  @IsString()
  emergencyContact?: string;

  @IsOptional()
  @IsString()
  emergencyPhone?: string;

  @IsOptional()
  @IsString()
  selfiePhoto?: string;

  @IsOptional()
  @IsString()
  cniPhoto?: string;

  @IsOptional()
  @IsString()
  permisPhoto?: string;

  @IsOptional()
  @IsString()
  vehiclePhoto?: string;
}

export class UpdateApplicationStatusDto {
  @IsIn(['approved', 'rejected', 'pending', 'pre_approved'])
  status: string;

  @IsOptional()
  @IsString()
  reviewedBy?: string;
}

export class QueryApplicationsDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  page?: string;

  @IsOptional()
  @IsString()
  limit?: string;
}
