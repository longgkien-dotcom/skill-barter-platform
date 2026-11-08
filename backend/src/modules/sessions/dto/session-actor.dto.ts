import { IsUUID } from 'class-validator';

export class SessionActorDto {
  @IsUUID()
  user_id!: string;
}
