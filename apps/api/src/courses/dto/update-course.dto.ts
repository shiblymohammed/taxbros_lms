import { IsString, IsOptional, IsEnum, IsInt, Min } from 'class-validator';
import { CourseStatus } from '@prisma/client';

/**
 * Update Course DTO
 * 
 * Requirements:
 * - R15.6: Support updating all course fields
 * - R16.1: Support publishing courses (status to PUBLISHED)
 * - R16.4: Support unpublishing courses (status to DRAFT)
 * - R16.7: Support archiving courses (status to ARCHIVED)
 * 
 * Example:
 * {
 *   "title": "Updated Course Title",
 *   "description": "Updated description",
 *   "status": "PUBLISHED",
 *   "displayOrder": 2
 * }
 */
export class UpdateCourseDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  coverImage?: string | null;

  @IsEnum(CourseStatus)
  @IsOptional()
  status?: CourseStatus;

  @IsInt()
  @Min(0)
  @IsOptional()
  displayOrder?: number;
}
