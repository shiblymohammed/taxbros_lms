import {
  IsString,
  IsNotEmpty,
  IsDateString,
  IsOptional,
  IsEmail,
  MinLength,
} from 'class-validator';

/**
 * Create Student DTO
 * 
 * Requirements:
 * - R1: Students require admissionId, firstName, lastName, admissionDate
 * - Creates both User account and Student profile
 * - Email and password required for authentication
 * - All students default to mustChangePassword=true
 * 
 * Example:
 * {
 *   "email": "student@example.com",
 *   "password": "SecurePass123",
 *   "admissionId": "STU2024001",
 *   "firstName": "John",
 *   "lastName": "Doe",
 *   "admissionDate": "2024-01-15",
 *   "dateOfBirth": "2005-05-20",
 *   "gender": "Male",
 *   "phoneNumber": "1234567890",
 *   "address": "123 Main St",
 *   "city": "Mumbai",
 *   "state": "Maharashtra",
 *   "pincode": "400001"
 * }
 */
export class CreateStudentDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  password: string;

  @IsString()
  @IsNotEmpty()
  admissionId: string;

  @IsString()
  @IsNotEmpty()
  firstName: string;

  @IsString()
  @IsNotEmpty()
  lastName: string;

  @IsDateString()
  @IsNotEmpty()
  admissionDate: string;

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
