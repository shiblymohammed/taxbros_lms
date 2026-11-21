import { PartialType } from '@nestjs/mapped-types';
import { CreateQuizDto } from './create-quiz.dto';
import { IsEnum, IsOptional } from 'class-validator';
import { QuizStatus } from '@prisma/client';

/**
 * DTO for updating a quiz
 * 
 * Requirements:
 * - R23.9: Support publishing (status → PUBLISHED)
 * - Allow updating all fields from CreateQuizDto
 */
export class UpdateQuizDto extends PartialType(CreateQuizDto) {
  @IsOptional()
  @IsEnum(QuizStatus)
  status?: QuizStatus;
}
