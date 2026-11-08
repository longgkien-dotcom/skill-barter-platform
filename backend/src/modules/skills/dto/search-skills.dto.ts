import { ProficiencyLevel, SkillType } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class SearchSkillsDto {
  @IsOptional()
  @IsEnum(SkillType)
  skill_type?: SkillType;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  category?: string;

  @IsOptional()
  @IsEnum(ProficiencyLevel)
  proficiency_level?: ProficiencyLevel;
}
