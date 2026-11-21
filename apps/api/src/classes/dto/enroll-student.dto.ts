import { IsNotEmpty, IsUUID } from 'class-validator';

/**
 * Enroll Student DTO
 * 
 * Requirements:
 * - R4: Enroll student in class with unique constraint
 * - Prevents duplicate enrollments
 * - Status defaults to ACTIVE
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
