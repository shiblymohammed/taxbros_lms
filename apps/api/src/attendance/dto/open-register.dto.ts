import { IsString, IsDateString, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class OpenRegisterDto {
  @ApiProperty({
    description: 'UUID of the class',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  @IsString()
  classId: string;

  @ApiProperty({
    description: 'Attendance date in ISO format (YYYY-MM-DD)',
    example: '2024-11-18',
  })
  @IsDateString()
  attendanceDate: string;
}
