import { ProficiencyLevel, SkillType } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateSkillDto {
  @IsUUID()
  user_id!: string;

  @IsEnum(SkillType)
  skill_type!: SkillType;

  @IsString()
  @MinLength(2)
  @MaxLength(80)
  category!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(160)
  title!: string;

  @IsEnum(ProficiencyLevel)
  proficiency_level!: ProficiencyLevel;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
