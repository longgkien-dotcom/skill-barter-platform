import { Type } from 'class-transformer';
import { IsInt, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

export class CreateReviewDto {
  @IsUUID()
  reviewer_id!: string;

  @IsUUID()
  reviewee_id!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  prep_score!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  attitude_score!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  knowledge_score!: number;

  @IsString()
  @MaxLength(2000)
  comment!: string;
}
