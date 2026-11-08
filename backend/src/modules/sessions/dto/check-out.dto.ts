import { IsUrl, IsUUID } from 'class-validator';

export class CheckOutDto {
  @IsUUID()
  teacher_id!: string;

  @IsUrl({ require_tld: true })
  proof_image_url!: string;
}
