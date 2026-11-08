import {
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateSafeZoneDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(5)
  @MaxLength(240)
  address?: string;

  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  latitude?: number;

  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  longitude?: number;

  @IsOptional()
  @IsString()
  @MinLength(16)
  @MaxLength(256)
  qr_code_hash?: string;
}
