import { IsBooleanString, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class QueryAdminMenuDto {
  @IsOptional()
  @IsString()
  cookId?: string;

  @IsOptional()
  @IsString()
  category?: string;

  // Filtre disponibilité : 'true' / 'false' / 'all' (défaut = all pour vue admin)
  @IsOptional()
  @IsIn(['true', 'false', 'all'])
  available?: 'true' | 'false' | 'all';

  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @IsOptional()
  @IsBooleanString()
  includeDeleted?: string;
}
