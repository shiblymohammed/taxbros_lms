import { IsString, IsOptional, IsInt, Min, Max, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { StaffCategory } from '@prisma/client';

/**
 * Query parameters for monthly staff attendance report
 */
export class MonthlyStaffAttendanceQueryDto {
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
    description: 'Optional department filter',
    example: 'Mathematics',
    required: false,
  })
  @IsOptional()
  @IsString()
  department?: string;

  @ApiProperty({
    description: 'Optional category filter (TEACHING or NON_TEACHING)',
    example: 'TEACHING',
    required: false,
    enum: StaffCategory,
  })
  @IsOptional()
  @IsEnum(StaffCategory)
  category?: StaffCategory;
}
