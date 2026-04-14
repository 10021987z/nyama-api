import { IsString, Matches } from 'class-validator';

export class AccessCodeDto {
  @IsString()
  @Matches(/^\+237[6-9]\d{8}$/, {
    message: 'phone doit être un numéro camerounais valide (ex: +237691000001)',
  })
  phone: string;

  @IsString()
  @Matches(/^NYAM-[A-Z0-9]{4}$/i, {
    message: 'Code d\'accès invalide (format attendu : NYAM-XXXX)',
  })
  accessCode: string;
}
