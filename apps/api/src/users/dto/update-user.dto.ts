import {
  IsEmail,
  IsEnum,
  IsString,
  IsOptional,
  IsDateString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { UserStatus, StaffCategory } from '@prisma/client';

/**
 * Update Student Profile DTO
 */
export class UpdateStudentProfileDto {
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

/**
 * Update Staff Profile DTO
 */
export class UpdateStaffProfileDto {
  @IsString()
  @IsOptional()
  staffId?: string;

  @IsString()
  @IsOptional()
  firstName?: string;

  @IsString()
  @IsOptional()
  lastName?: string;

  @IsString()
  @IsOptional()
  designation?: string;

  @IsString()
  @IsOptional()
  department?: string;

  @IsEnum(StaffCategory)
  @IsOptional()
  category?: StaffCategory;

  @IsDateString()
  @IsOptional()
  joiningDate?: string;

  @IsString()
  @IsOptional()
  phoneNumber?: string;

  @IsString()
  @IsOptional()
  address?: string;
}

/**
 * Update User DTO
 * 
 * Allows partial updates to user accounts and role-specific profiles.
 * All fields are optional.
 * 
 * Uniqueness Validation:
 * - If email is updated, checks uniqueness across all users
 * - If admissionId is updated, checks uniqueness across all students
 * - If staffId is updated, checks uniqueness across all staff
 * 
 * Note: Password updates are handled separately via change-password endpoint.
 * Note: Role changes are not supported after account creation.
 * Note: Status changes use dedicated activate/deactivate endpoints.
 */
export class UpdateUserDto {
  @IsEmail()
  @IsOptional()
  email?: string;

  @IsEnum(UserStatus)
  @IsOptional()
  status?: UserStatus;

  @ValidateNested()
  @Type(() => UpdateStudentProfileDto)
  @IsOptional()
  studentProfile?: UpdateStudentProfileDto;

  @ValidateNested()
  @Type(() => UpdateStaffProfileDto)
  @IsOptional()
  staffProfile?: UpdateStaffProfileDto;
}
