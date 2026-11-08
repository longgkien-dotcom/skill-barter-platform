import { IsNumber, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateSafeZoneDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsString()
  @MinLength(5)
  @MaxLength(240)
  address!: string;

  @IsNumber({ allowNaN: false, allowInfinity: false })
  latitude!: number;

  @IsNumber({ allowNaN: false, allowInfinity: false })
  longitude!: number;

  @IsString()
  @MinLength(16)
  @MaxLength(256)
  qr_code_hash!: string;
}
