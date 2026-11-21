import { IsOptional, IsInt, Min, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { CourseEnrollmentStatus } from '@prisma/client';

/**
 * Query Enrollment DTO
 * 
 * Requirements:
 * - R5: List course enrollments with pagination
 * - Support filtering by enrollment status
 * 
 * Example:
 * GET /courses/:courseId/enrollments?status=ACTIVE&page=1&limit=10
 */
export class QueryEnrollmentDto {
  @IsOptional()
  @IsEnum(CourseEnrollmentStatus)
  status?: CourseEnrollmentStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}
