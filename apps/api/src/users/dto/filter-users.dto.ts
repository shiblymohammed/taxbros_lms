import { IsDateString, IsEnum, IsOptional, IsString, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { StaffCategory, UserRole, UserStatus } from '@prisma/client';

/**
 * Filter Users DTO
 * 
 * Supports filtering and searching users by multiple criteria:
 * - role: Filter by user role (ADMINISTRATOR, STAFF, STUDENT)
 * - status: Filter by account status (ACTIVE, INACTIVE, PENDING)
 * - search: Search by name or email (case-insensitive partial match)
 * 
 * Pagination:
 * - page: Page number (1-indexed, default: 1)
 * - limit: Results per page (default: 10, max: 100)
 * 
 * Response includes:
 * - data: Array of user records with profiles
 * - meta: { total, page, limit, totalPages }
 * 
 * Example queries:
 * - GET /users?role=STUDENT&status=ACTIVE&page=1&limit=20
 * - GET /users?search=john&page=2
 * - GET /users?status=INACTIVE
 */
export class FilterUsersDto {
  @IsEnum(UserRole)
  @IsOptional()
  role?: UserRole;

  @IsEnum(UserStatus)
  @IsOptional()
  status?: UserStatus;

  @IsString()
  @IsOptional()
  search?: string;

  // Student filters (R1.11); any of these limits results to students
  @IsString()
  @IsOptional()
  admissionId?: string;

  @IsString()
  @IsOptional()
  classId?: string;

  @IsDateString()
  @IsOptional()
  admissionDateFrom?: string;

  @IsDateString()
  @IsOptional()
  admissionDateTo?: string;

  // Staff filters (R1.12); any of these limits results to staff
  @IsString()
  @IsOptional()
  staffId?: string;

  @IsString()
  @IsOptional()
  department?: string;

  @IsEnum(StaffCategory)
  @IsOptional()
  category?: StaffCategory;

  @IsString()
  @IsOptional()
  designation?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  limit?: number = 10;
}
