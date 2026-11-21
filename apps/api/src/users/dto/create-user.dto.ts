import {
  IsEmail,
  IsEnum,
  IsString,
  MinLength,
  IsNotEmpty,
  IsOptional,
  IsDateString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { UserRole, StaffCategory } from '@prisma/client';

/**
 * Student Profile DTO for user creation
 */
export class CreateStudentProfileDto {
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

/**
 * Staff Profile DTO for user creation
 */
export class CreateStaffProfileDto {
  @IsString()
  @IsNotEmpty()
  staffId: string;

  @IsString()
  @IsNotEmpty()
  firstName: string;

  @IsString()
  @IsNotEmpty()
  lastName: string;

  @IsString()
  @IsNotEmpty()
  designation: string;

  @IsString()
  @IsNotEmpty()
  department: string;

  @IsEnum(StaffCategory)
  @IsNotEmpty()
  category: StaffCategory;

  @IsDateString()
  @IsNotEmpty()
  joiningDate: string;

  @IsString()
  @IsOptional()
  phoneNumber?: string;

  @IsString()
  @IsOptional()
  address?: string;
}

/**
 * Create User DTO
 * 
 * Validates user account creation with role-specific profile requirements.
 * 
 * Requirements:
 * - All users: email, password, role
 * - Students: studentProfile with admissionId, firstName, lastName, admissionDate
 * - Staff: staffProfile with staffId, firstName, lastName, designation, department, category, joiningDate
 * - Administrator: no additional profile required
 * 
 * Uniqueness Constraints:
 * - email must be unique across all users
 * - admissionId must be unique across all students
 * - staffId must be unique across all staff
 * 
 * Password Security:
 * - Minimum 8 characters
 * - Will be hashed with bcrypt (12 salt rounds)
 * - mustChangePassword flag set to true by default
 */
export class CreateUserDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  password: string;

  @IsEnum(UserRole)
  @IsNotEmpty()
  role: UserRole;

  @ValidateNested()
  @Type(() => CreateStudentProfileDto)
  @IsOptional()
  studentProfile?: CreateStudentProfileDto;

  @ValidateNested()
  @Type(() => CreateStaffProfileDto)
  @IsOptional()
  staffProfile?: CreateStaffProfileDto;
}
