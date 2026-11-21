import { PartialType } from '@nestjs/mapped-types';
import { CreateLessonDto } from './create-lesson.dto';
import { IsEnum, IsOptional } from 'class-validator';
import { LessonStatus } from '@prisma/client';

/**
 * DTO for updating a lesson
 * 
 * Requirements:
 * - R18: Support updating all lesson properties
 * - R19: Support publishing/unpublishing via status field
 */
export class UpdateLessonDto extends PartialType(CreateLessonDto) {
  @IsOptional()
  @IsEnum(LessonStatus)
  status?: LessonStatus;
}
