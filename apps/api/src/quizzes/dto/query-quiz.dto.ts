import { IsOptional, IsEnum, IsString } from 'class-validator';
import { QuizStatus, QuizAttachmentType } from '@prisma/client';

/**
 * DTO for querying quizzes with filters
 * 
 * Supports filtering by:
 * - status (DRAFT, PUBLISHED)
 * - attachmentType (COURSE, MODULE, LESSON)
 * - courseId, moduleId, lessonId
 */
export class QueryQuizDto {
  @IsOptional()
  @IsEnum(QuizStatus)
  status?: QuizStatus;

  @IsOptional()
  @IsEnum(QuizAttachmentType)
  attachmentType?: QuizAttachmentType;

  @IsOptional()
  @IsString()
  courseId?: string;

  @IsOptional()
  @IsString()
  moduleId?: string;

  @IsOptional()
  @IsString()
  lessonId?: string;
}
