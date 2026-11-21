import { IsInt, IsOptional, IsString, IsEnum, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * DTO for monthly student attendance report query parameters
 */
export class GetMonthlyStudentAttendanceDto {
  @IsInt()
  @Min(2020)
  @Max(2100)
  @Type(() => Number)
  year: number;

  @IsInt()
  @Min(1)
  @Max(12)
  @Type(() => Number)
  month: number;

  @IsOptional()
  @IsString()
  classId?: string;
}

/**
 * DTO for monthly staff attendance report query parameters
 */
export class GetMonthlyStaffAttendanceDto {
  @IsInt()
  @Min(2020)
  @Max(2100)
  @Type(() => Number)
  year: number;

  @IsInt()
  @Min(1)
  @Max(12)
  @Type(() => Number)
  month: number;

  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @IsEnum(['TEACHING', 'NON_TEACHING'])
  category?: 'TEACHING' | 'NON_TEACHING';
}
