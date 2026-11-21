import {
  IsString,
  IsDateString,
  IsOptional,
  IsEmail,
} from 'class-validator';

/**
 * Update Student DTO
 * 
 * Requirements:
 * - All fields are optional for partial updates
 * - R1: Validate uniqueness constraints
 * - Profile updates are merged (not replaced)
 * 
 * Example:
 * {
 *   "firstName": "Jane",
 *   "phoneNumber": "9876543210",
 *   "city": "Delhi"
 * }
 */
export class UpdateStudentDto {
  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  admissionId?: string;

  @IsString()
  @IsOptional()
  firstName?: string;

  @IsString()
  @IsOptional()
  lastName?: string;

  @IsDateString()
  @IsOptional()
  admissionDate?: string;

  @IsDateString()
  @IsOptional()
  dateOfBirth?: string;

  @IsString()
  @IsOptional()
  gender?: string;

  @IsString()
  @IsOptional()
  phoneNumber?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  city?: string;

  @IsString()
  @IsOptional()
  state?: string;

  @IsString()
  @IsOptional()
  pincode?: string;
}
