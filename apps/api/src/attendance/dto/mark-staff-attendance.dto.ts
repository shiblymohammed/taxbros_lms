import { IsString, IsEnum, IsOptional, IsDateString } from 'class-validator';
import { AttendanceStatus } from '@prisma/client';

/**
 * DTO for marking staff attendance
 * Used for POST /attendance/staff endpoint
 */
export class MarkStaffAttendanceDto {
  @IsString()
  staffId: string;

  @IsDateString()
  attendanceDate: string; // ISO date string (YYYY-MM-DD)

  @IsEnum(AttendanceStatus)
  status: AttendanceStatus;

  @IsOptional()
  @IsString()
  remarks?: string;
}
