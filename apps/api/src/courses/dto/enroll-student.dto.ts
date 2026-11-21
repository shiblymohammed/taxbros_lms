import { IsUUID, IsNotEmpty } from 'class-validator';

/**
 * Enroll Student DTO
 * 
 * Requirements:
 * - R5: Enroll student in course with unique constraint
 * - Prevents duplicate enrollments
 * - Status defaults to ACTIVE, progressPercentage defaults to 0
 * 
 * Example:
 * {
 *   "studentId": "123e4567-e89b-12d3-a456-426614174000"
 * }
 */
export class EnrollStudentDto {
  @IsUUID()
  @IsNotEmpty()
  studentId: string;
}
