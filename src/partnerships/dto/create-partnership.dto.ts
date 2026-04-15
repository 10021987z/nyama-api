import { IsString, IsOptional, IsEmail, IsIn } from 'class-validator';

export class CreatePartnershipDto {
  @IsIn(['cuisiniere', 'livreur'])
  type: string;

  @IsString()
  firstName: string;

  @IsString()
  lastName: string;

  @IsString()
  phone: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  companyName?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  city: string;

  @IsString()
  quarter: string;

  @IsOptional()
  @IsIn(['moto', 'velo', 'voiture', 'a_pied'])
  vehicleType?: string;

  @IsOptional()
  @IsString()
  idNumber?: string;

  // Documents KYC (URLs renvoyées par /uploads/document)
  @IsOptional()
  @IsString()
  idDocumentUrl?: string;

  @IsOptional()
  @IsString()
  selfieUrl?: string;

  @IsOptional()
  @IsString()
  licenseUrl?: string;

  @IsOptional()
  @IsString()
  insuranceUrl?: string;
}
