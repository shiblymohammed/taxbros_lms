import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { IsLatitude, IsLongitude, IsOptional, IsString, IsUUID, Matches } from 'class-validator';

/** Optional device location, used when the institute location check is on. */
export class LocationDto {
  @ApiPropertyOptional({ example: 9.9312 })
  @IsOptional()
  @IsLatitude()
  latitude?: number;

  @ApiPropertyOptional({ example: 76.2673 })
  @IsOptional()
  @IsLongitude()
  longitude?: number;
}

export class StudentCheckInDto extends LocationDto {
  @ApiProperty({ description: 'Six-digit code shown on the teacher screen', example: '048213' })
  @IsString()
  @Matches(/^\s*\d{6}\s*$/, { message: 'The code has 6 digits' })
  code: string;

  @ApiPropertyOptional({ description: 'Register the QR code was made for (from the QR link)' })
  @IsOptional()
  @IsUUID()
  registerId?: string;
}
