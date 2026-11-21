import { IsEnum, IsOptional, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { CourseStatus } from '@prisma/client';

/**
 * Query Course DTO
 * 
 * Requirements:
 * - R16.2: Filter by status (PUBLISHED courses visible to students)
 * - R16.3: DRAFT courses hidden from students
 * - R16.8: ARCHIVED courses excluded from enrollment operations
 * 
 * Example:
 * GET /courses?status=PUBLISHED&page=1&limit=10
 */
export class QueryCourseDto {
  @IsEnum(CourseStatus)
  @IsOptional()
  status?: CourseStatus;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  limit?: number = 10;
}
