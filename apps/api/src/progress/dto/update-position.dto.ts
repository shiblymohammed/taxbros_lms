import { IsNumber, Min, IsOptional } from 'class-validator';

/**
 * DTO for updating video playback position
 *
 * Requirements: R20
 * 
 * This DTO accepts:
 * - position: Current playback position in seconds (required)
 * - watchedDuration: Total watched duration increment in seconds (optional)
 *   If not provided, the service will calculate the increment internally
 */
export class UpdatePositionDto {
  @IsNumber()
  @Min(0)
  position: number; // Position in seconds (R20.3, R20.7)

  @IsOptional()
  @IsNumber()
  @Min(0)
  watchedDuration?: number; // Incremental watched duration in seconds (R20.8)
}
