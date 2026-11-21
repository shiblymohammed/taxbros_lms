import { IsString, IsNotEmpty, IsEnum, IsDateString, IsOptional, MinLength } from 'class-validator';
import { StaffCategory } from '@prisma/client';

export class CreateStaffDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  staffId: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  firstName: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  lastName: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  designation: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  department: string;

  @IsEnum(StaffCategory)
  category: StaffCategory;

  @IsDateString()
  joiningDate: string;

  @IsString()
  @IsOptional()
  phoneNumber?: string;

  @IsString()
  @IsOptional()
  address?: string;
}
