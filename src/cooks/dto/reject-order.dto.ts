import { IsString, MinLength } from 'class-validator';

export class RejectOrderDto {
  @IsString()
  @MinLength(3, { message: 'Le motif de refus doit être renseigné' })
  reason: string;
}
