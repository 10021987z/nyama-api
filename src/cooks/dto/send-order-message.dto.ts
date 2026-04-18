import { IsString, MinLength, MaxLength } from 'class-validator';

export class SendOrderMessageDto {
  @IsString()
  @MinLength(1, { message: 'Le message ne peut pas être vide' })
  @MaxLength(2000)
  text: string;
}
