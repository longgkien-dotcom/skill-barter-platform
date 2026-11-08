import { SessionStatus } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';

export class ListSessionsDto {
  @IsOptional()
  @IsEnum(SessionStatus)
  status?: SessionStatus;
}
