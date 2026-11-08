import { IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CheckInDto {
  @IsUUID()
  user_id!: string;

  @IsString()
  @MinLength(16)
  @MaxLength(256)
  qr_code_hash!: string;
}
