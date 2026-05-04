import {
  IsString,
  IsNumber,
  IsIn,
  IsOptional,
  IsArray,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentMethod } from '@prisma/client';
import { CreateOrderItemDto } from './create-order-item.dto';

const ACCEPTED_PAYMENT_METHODS = [
  PaymentMethod.MTN_MOMO,
  PaymentMethod.ORANGE_MONEY,
] as const;

export class CreateOrderDto {
  @IsString()
  cookId: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items: CreateOrderItemDto[];

  @IsString()
  deliveryAddress: string;

  @IsNumber()
  deliveryLat: number;

  @IsNumber()
  deliveryLng: number;

  @IsOptional()
  @IsString()
  landmark?: string;

  @IsIn(ACCEPTED_PAYMENT_METHODS, {
    message:
      "Méthode de paiement invalide : seuls MTN_MOMO et ORANGE_MONEY sont acceptés",
  })
  paymentMethod: (typeof ACCEPTED_PAYMENT_METHODS)[number];

  @IsOptional()
  @IsString()
  clientNote?: string;
}
