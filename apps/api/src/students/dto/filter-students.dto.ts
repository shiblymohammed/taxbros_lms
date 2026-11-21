import {
  IsOptional,
  IsString,
  IsInt,
  Min,
  IsDateString,
  IsBoolean,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

/**
 * Filter Students DTO
 * 
 * Requirements:
 * - R1: Support filtering by admission ID, class enrollment, admission date range
 * - Support searching by name, email, admission ID
 * - Pagination with page and limit
 * 
 * Query Parameters:
 * - search: Search by name, email, or admission ID (case-insensitive)
 * - classId: Filter by class enrollment (UUID)
 * - admissionDateFrom: Filter students admitted on or after this date
 * - admissionDateTo: Filter students admitted on or before this date
 * - page: Page number (1-indexed, default: 1)
 * - limit: Results per page (default: 10, max: 100)
 * 
 * Example queries:
 * - GET /students?search=john&page=1&limit=20
 * - GET /students?classId=uuid&page=1
 * - GET /students?admissionDateFrom=2024-01-01&admissionDateTo=2024-12-31
 */
export class FilterStudentsDto {
  @IsString()
  @IsOptional()
  search?: string;

  @IsString()
  @IsOptional()
  classId?: string;

  @IsDateString()
  @IsOptional()
  admissionDateFrom?: string;

  /** Only students whose account is ACTIVE (pickers for classes and courses) */
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  @IsOptional()
  activeOnly?: boolean;

  @IsDateString()
  @IsOptional()
  admissionDateTo?: string;

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
