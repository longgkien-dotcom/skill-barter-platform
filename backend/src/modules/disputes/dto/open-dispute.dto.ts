import { IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class OpenDisputeDto {
  @IsUUID()
  session_id!: string;

  @IsUUID()
  complainant_id!: string;

  @IsString()
  @MinLength(10)
  @MaxLength(4000)
  reason!: string;
}
