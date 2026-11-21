import { IsOptional, IsDateString, IsEnum } from 'class-validator';
import { AttendanceStatus } from '@prisma/client';

/**
 * DTO for querying staff attendance records
 * Used for GET /attendance/staff endpoint
 */
export class GetStaffAttendanceQueryDto {
  @IsOptional()
  @IsDateString()
  dateFrom?: string; // ISO date string (YYYY-MM-DD)

  @IsOptional()
  @IsDateString()
  dateTo?: string; // ISO date string (YYYY-MM-DD)

  @IsOptional()
  @IsEnum(AttendanceStatus)
  status?: AttendanceStatus;

  @IsOptional()
  staffId?: string; // Filter by specific staff member
}
