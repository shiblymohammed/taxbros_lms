import { IsString, IsNotEmpty, IsArray, ValidateNested, IsOptional, IsBoolean, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * DTO for quiz submission
 * 
 * Requirements:
 * - R25.3: Validate answers provided for all questions
 * - R25.9: Store answers as JSON array with questionId and selectedAnswer
 * 
 * Task 39: Quiz submission endpoint
 */

export class QuizAnswerDto {
  @IsString()
  @IsNotEmpty()
  questionId: string;

  @IsString()
  @IsNotEmpty()
  selectedAnswer: string;
}

export class SubmitQuizDto {
  @IsArray()
  @IsNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => QuizAnswerDto)
  answers: QuizAnswerDto[];

  /** Set by the app when a timed quiz ran out of time: unanswered questions then score 0 (R25). */
  @IsOptional()
  @IsBoolean()
  timedOut?: boolean;

  /** When the student opened the quiz (ISO time), recorded on the attempt (R25.7). */
  @IsOptional()
  @IsDateString()
  startedAt?: string;
}
