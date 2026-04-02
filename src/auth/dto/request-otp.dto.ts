import { IsString, Matches } from 'class-validator';

export class RequestOtpDto {
  @IsString()
  @Matches(/^\+237[6-9]\d{8}$/, {
    message: 'phone doit être un numéro camerounais valide (ex: +237691000001)',
  })
  phone: string;
}
