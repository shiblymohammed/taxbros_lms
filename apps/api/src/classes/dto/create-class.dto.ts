import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

/**
 * Create Class DTO
 * 
 * Requirements:
 * - R4: Classes require unique name
 * - Description is optional
 * - Status defaults to ACTIVE
 * 
 * Example:
 * {
 *   "name": "Batch 2024 Morning",
 *   "description": "Morning batch for 2024 intake"
 * }
 */
export class CreateClassDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;
}
