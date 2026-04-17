import { IsIn, IsNotEmpty, IsString, Matches } from 'class-validator';

export class InitiatePaymentDto {
  @IsString()
  @IsNotEmpty()
  orderId!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^\+?\d{8,15}$/, {
    message: 'phone doit être un numéro au format E.164 (ex: +237699000001)',
  })
  phone!: string;

  @IsIn(['mtn', 'orange', 'cash'])
  provider!: 'mtn' | 'orange' | 'cash';
}
