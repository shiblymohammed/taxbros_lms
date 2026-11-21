import { IsString, IsEnum, IsDateString, IsOptional, MinLength } from 'class-validator';
import { StaffCategory } from '@prisma/client';

export class UpdateStaffDto {
  @IsString()
  @IsOptional()
  @MinLength(1)
  staffId?: string;

  @IsString()
  @IsOptional()
  @MinLength(1)
  firstName?: string;

  @IsString()
  @IsOptional()
  @MinLength(1)
  lastName?: string;

  @IsString()
  @IsOptional()
  @MinLength(1)
  designation?: string;

  @IsString()
  @IsOptional()
  @MinLength(1)
  department?: string;

  @IsEnum(StaffCategory)
  @IsOptional()
  category?: StaffCategory;

  @IsDateString()
  @IsOptional()
  joiningDate?: string;

  @IsString()
  @IsOptional()
  phoneNumber?: string;

  @IsString()
  @IsOptional()
  address?: string;
}
