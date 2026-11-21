import { IsOptional, IsEnum, IsString, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { StaffCategory } from '@prisma/client';

export class GetStaffQueryDto {
  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @IsEnum(StaffCategory)
  category?: StaffCategory;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 10;
}
