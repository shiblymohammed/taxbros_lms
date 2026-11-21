import { IsOptional, IsEnum, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ClassStatus } from '@prisma/client';

/**
 * Query Class DTO
 * 
 * Requirements:
 * - R4: Filter classes by status
 * - Support pagination
 * 
 * Example:
 * GET /classes?status=ACTIVE&page=1&limit=10
 */
export class QueryClassDto {
  @IsEnum(ClassStatus)
  @IsOptional()
  status?: ClassStatus;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  limit?: number = 10;
}
