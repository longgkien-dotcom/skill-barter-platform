import { TribunalVoteChoice } from '@prisma/client';
import { IsEnum, IsUUID } from 'class-validator';

export class VoteDisputeDto {
  @IsUUID()
  voter_id!: string;

  @IsEnum(TribunalVoteChoice)
  choice!: TribunalVoteChoice;
}
