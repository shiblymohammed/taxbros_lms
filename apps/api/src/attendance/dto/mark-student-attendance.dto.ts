import { IsString, IsEnum, IsOptional, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { AttendanceStatus } from '@prisma/client';

export class AttendanceMarkDto {
  @ApiProperty({
    description: 'UUID of the student',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsString()
  studentId: string;

  @ApiProperty({
    description: 'Attendance status',
    enum: AttendanceStatus,
    example: 'PRESENT',
  })
  @IsEnum(AttendanceStatus)
  status: AttendanceStatus;

  @ApiProperty({
    description: 'Optional remarks about the attendance',
    example: 'Left early for medical appointment',
    required: false,
  })
  @IsOptional()
  @IsString()
  remarks?: string;
}

export class MarkStudentAttendanceDto {
  @ApiProperty({
    description: 'Array of attendance marks for students',
    type: [AttendanceMarkDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttendanceMarkDto)
  marks: AttendanceMarkDto[];
}
