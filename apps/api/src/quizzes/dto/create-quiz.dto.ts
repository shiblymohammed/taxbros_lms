import { IsString, IsNotEmpty, IsOptional, IsInt, IsEnum, Min, ValidateIf, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { QuizAttachmentType } from '@prisma/client';

/**
 * DTO for quiz option
 */
export class QuizOptionDto {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsString()
  @IsNotEmpty()
  text: string;
}

/**
 * DTO for creating quiz questions inline with quiz
 */
export class CreateQuizQuestionDto {
  @IsString()
  @IsNotEmpty()
  questionText: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuizOptionDto)
  options: QuizOptionDto[];

  @IsString()
  @IsNotEmpty()
  correctAnswer: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  marks?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  displayOrder?: number;
}

/**
 * DTO for creating a quiz
 * 
 * Requirements:
 * - R23.1: Require title
 * - R23.2: Validate attachmentType and corresponding ID
 * - R23.3: Set passMark and totalMarks
 * - R23.4: Optional time limit
 * 
 * Validation:
 * - If attachmentType is COURSE, courseId is required
 * - If attachmentType is MODULE, moduleId is required
 * - If attachmentType is LESSON, lessonId is required
 * - passMark must be less than or equal to totalMarks
 */
export class CreateQuizDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(QuizAttachmentType)
  @IsNotEmpty()
  attachmentType: QuizAttachmentType;

  @ValidateIf((o) => o.attachmentType === QuizAttachmentType.COURSE)
  @IsString()
  @IsNotEmpty()
  courseId?: string;

  @ValidateIf((o) => o.attachmentType === QuizAttachmentType.MODULE)
  @IsString()
  @IsNotEmpty()
  moduleId?: string;

  @ValidateIf((o) => o.attachmentType === QuizAttachmentType.LESSON)
  @IsString()
  @IsNotEmpty()
  lessonId?: string;

  @IsInt()
  @Min(0)
  passMark: number;

  @IsInt()
  @Min(1)
  totalMarks: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  timeLimit?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxAttempts?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  displayOrder?: number;
}

/**
 * DTO for creating quiz with questions in one request
 */
export class CreateQuizWithQuestionsDto extends CreateQuizDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateQuizQuestionDto)
  questions?: CreateQuizQuestionDto[];
}
