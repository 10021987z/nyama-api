import { IsString, Length, Matches } from 'class-validator';

export class VerifyOtpDto {
  @IsString()
  @Matches(/^\+237[6-9]\d{8}$/, {
    message: 'phone doit être un numéro camerounais valide (ex: +237691000001)',
  })
  phone: string;

  @IsString()
  @Length(6, 6, { message: 'Le code OTP doit faire exactement 6 chiffres' })
  code: string;
}
