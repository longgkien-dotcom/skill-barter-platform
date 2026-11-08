import { ProficiencyLevel, SkillType } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateSkillDto {
  @IsOptional()
  @IsEnum(SkillType)
  skill_type?: SkillType;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  category?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  title?: string;

  @IsOptional()
  @IsEnum(ProficiencyLevel)
  proficiency_level?: ProficiencyLevel;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
