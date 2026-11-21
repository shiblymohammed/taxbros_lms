import { IsString, IsOptional, IsInt, Min, MaxLength } from 'class-validator';

/**
 * DTO for creating a course module
 * 
 * Requirements:
 * - R17.1: Require title
 * - R17.4: Allow optional description
 * - R17.5: Support display order
 */
export class CreateModuleDto {
  @IsString()
  @MaxLength(255)
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  displayOrder?: number;
}
