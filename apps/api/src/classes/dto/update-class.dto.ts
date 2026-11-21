import { IsString, IsOptional, IsEnum } from 'class-validator';
import { ClassStatus } from '@prisma/client';

/**
 * Update Class DTO
 * 
 * Requirements:
 * - R4: Supports updating name, description, and status
 * - Name must remain unique if changed
 * - Status can be ACTIVE or ARCHIVED
 * 
 * Example:
 * {
 *   "name": "Batch 2024 Morning - Updated",
 *   "description": "Updated description",
 *   "status": "ARCHIVED"
 * }
 */
export class UpdateClassDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(ClassStatus)
  @IsOptional()
  status?: ClassStatus;
}
