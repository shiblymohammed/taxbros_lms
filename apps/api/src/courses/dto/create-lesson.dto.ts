import { IsString, IsOptional, IsInt, Min, MaxLength, IsUrl } from 'class-validator';

/**
 * DTO for creating a lesson within a module
 * 
 * Requirements:
 * - R18.1: Require title and YouTube video URL
 * - R18.2: Validate YouTube URL format
 * - R18.7: Store optional duration in seconds
 * - R18.8: Allow optional description
 */
export class CreateLessonDto {
  @IsString()
  @MaxLength(255)
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  @IsUrl({}, { message: 'Video URL must be a valid URL' })
  videoUrl: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  duration?: number; // Duration in seconds

  @IsOptional()
  @IsInt()
  @Min(0)
  displayOrder?: number;
}
