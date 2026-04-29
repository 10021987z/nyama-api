import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export enum AdminMessageChannel {
  INAPP = 'inapp',
  PUSH = 'push',
  SMS = 'sms',
  EMAIL = 'email',
}

export enum AdminMessageRecipientType {
  RESTAURANT = 'restaurant',
  RIDER = 'rider',
  CUSTOMER = 'customer',
}

/**
 * Le dashboard envoie deux formats à /admin/messages :
 *   chat/page.tsx        : { userId, body }
 *   admin-mutations.ts   : { to, toType, channel?, subject?, body }
 * On accepte les deux. `userId` ou `to` doit être fourni ; le rôle de
 * l'utilisateur est résolu via DB pour router vers la bonne room socket.
 */
export class SendAdminMessageDto {
  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  to?: string;

  @IsOptional()
  @IsEnum(AdminMessageRecipientType)
  toType?: AdminMessageRecipientType;

  @IsOptional()
  @IsEnum(AdminMessageChannel)
  channel?: AdminMessageChannel;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  subject?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  body!: string;
}
