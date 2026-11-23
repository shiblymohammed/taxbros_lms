import {
  IsString,
  IsNotEmpty,
  IsArray,
  IsInt,
  Min,
  IsOptional,
  ValidateNested,
  ArrayMinSize,
  ArrayMaxSize,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * DTO for creating a quiz question
 * 
 * Requirements:
 * - R24.1: Require question text, options array, and correct answer ID
 * - R24.2: Options as JSON array with id and text properties
 * - R24.3: Validate correct answer matches one option ID
 * - R24.4: Allow optional marks per question (default 1)
 */

export class QuizOptionDto {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsString()
  @IsNotEmpty()
  text: string;
}

export class CreateQuestionDto {
  @IsString()
  @IsNotEmpty()
  questionText: string;

  // @Type is required: without it the global pipe's implicit conversion turns each option
  // into an empty array, and the options are saved as [] (R24.2)
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(6)
  @ValidateNested({ each: true })
  @Type(() => QuizOptionDto)
  options: QuizOptionDto[];

  @IsString()
  @IsNotEmpty()
  correctAnswer: string; // Must match one of the option IDs

  @IsOptional()
  @IsInt()
  @Min(1)
  marks?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  displayOrder?: number;
}
