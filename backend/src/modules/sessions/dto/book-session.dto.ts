import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsInt,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

class MicroContractDto {
  @IsArray()
  @ArrayMinSize(3)
  @ArrayMaxSize(3)
  @IsString({ each: true })
  @MinLength(3, { each: true })
  @MaxLength(300, { each: true })
  milestones!: string[];
}

export class BookSessionDto {
  @IsUUID()
  student_id!: string;

  @IsUUID()
  skill_id!: string;

  @IsUUID()
  safe_zone_id!: string;

  @ValidateNested()
  @Type(() => MicroContractDto)
  micro_contract!: MicroContractDto;

  @IsDateString()
  scheduled_start!: string;

  @IsDateString()
  scheduled_end!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  cost_credits!: number;
}
