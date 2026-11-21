import { IsString, IsOptional, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Query parameters for monthly student attendance report
 */
export class MonthlyStudentAttendanceQueryDto {
  @ApiProperty({
    description: 'Year (YYYY format)',
    example: 2024,
    required: true,
  })
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year: number;

  @ApiProperty({
    description: 'Month (1-12)',
    example: 11,
    required: true,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month: number;

  @ApiProperty({
    description: 'Optional class ID to filter by specific class',
    example: 'class-uuid-here',
    required: false,
  })
  @IsOptional()
  @IsString()
  classId?: string;
}
