import { IsOptional, IsUUID, IsEnum, IsDateString } from 'class-validator';
import { AttendanceStatus } from '@prisma/client';
import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO for filtering student attendance history
 * 
 * Requirements:
 * - R10.1: Support filtering by Student ID
 * - R10.2: Support filtering by class ID
 * - R10.3: Support filtering by date range
 * - R10.4: Support filtering by attendance status
 */
export class GetStudentAttendanceQueryDto {
  @ApiProperty({
    description: 'Student ID to filter by',
    required: false,
    type: String,
  })
  @IsOptional()
  @IsUUID()
  studentId?: string;

  @ApiProperty({
    description: 'Class ID to filter by',
    required: false,
    type: String,
  })
  @IsOptional()
  @IsUUID()
  classId?: string;

  @ApiProperty({
    description: 'Start date for date range filter (ISO date format)',
    required: false,
    example: '2024-01-01',
  })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiProperty({
    description: 'End date for date range filter (ISO date format)',
    required: false,
    example: '2024-12-31',
  })
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @ApiProperty({
    description: 'Attendance status to filter by',
    required: false,
    enum: AttendanceStatus,
  })
  @IsOptional()
  @IsEnum(AttendanceStatus)
  status?: AttendanceStatus;
}
