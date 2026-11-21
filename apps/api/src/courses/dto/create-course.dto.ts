import { IsString, IsNotEmpty, IsOptional, IsInt, Min } from 'class-validator';

/**
 * Create Course DTO
 * 
 * Requirements:
 * - R15.1: Course requires title
 * - R15.2: Status defaults to DRAFT
 * - R15.8: Description is optional with no length limit
 * - R15.10: Display order is optional
 * 
 * Example:
 * {
 *   "title": "Introduction to Tax Filing",
 *   "description": "Learn the basics of tax filing and compliance",
 *   "displayOrder": 1
 * }
 */
export class CreateCourseDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  displayOrder?: number;
}
