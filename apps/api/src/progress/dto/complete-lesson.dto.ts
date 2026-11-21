import { IsOptional, IsString } from 'class-validator';

/**
 * Complete Lesson DTO
 * 
 * Used for manual lesson completion endpoint.
 * 
 * Requirements:
 * - R21: Manual lesson completion
 * 
 * All fields optional to allow simple POST request.
 */
export class CompleteLessonDto {
  @IsOptional()
  @IsString()
  notes?: string;
}
