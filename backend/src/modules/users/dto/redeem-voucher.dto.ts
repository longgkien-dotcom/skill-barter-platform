import { CreditType } from '@prisma/client';
import { IsEnum, IsInt, Min } from 'class-validator';

export class RedeemVoucherDto {
  @IsInt()
  @Min(1)
  amount!: number;

  @IsEnum(CreditType)
  credit_type!: CreditType;
}
