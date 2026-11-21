import { PartialType } from '@nestjs/mapped-types';
import { CreateQuestionDto } from './create-question.dto';

/**
 * DTO for updating a quiz question
 * 
 * Requirements:
 * - R24.6: Allow editing question text, options, and correct answer
 */
export class UpdateQuestionDto extends PartialType(CreateQuestionDto) {}
