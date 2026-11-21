import { IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO for activating/deactivating a lab
 *
 * Requirements: R27 (Government Portal Lab Management)
 */
export class UpdateLabStatusDto {
  @ApiProperty({ description: 'Whether students can access the lab', example: true })
  @IsBoolean()
  isActive: boolean;
}
