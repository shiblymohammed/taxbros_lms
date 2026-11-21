import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Refresh Token DTO for POST /auth/refresh endpoint
 * 
 * Used when refresh token is passed in request body instead of cookie.
 * Note: The primary implementation uses httpOnly cookies.
 * 
 * **Validates Requirements:** R2 (RBAC), R36 (Session Management)
 */
export class RefreshTokenDto {
  @ApiProperty({
    description: 'Refresh token for obtaining a new access token',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    type: String,
  })
  @IsString()
  @IsNotEmpty({ message: 'Refresh token is required' })
  refreshToken: string;
}
