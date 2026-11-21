import { IsEmail, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Login DTO for POST /auth/login endpoint
 * 
 * Validates user credentials during authentication.
 * 
 * **Validates Requirements:** R2 (RBAC), R36 (Authentication)
 */
export class LoginDto {
  @ApiProperty({
    description: 'User email address',
    example: 'admin@taxbros.edu',
    type: String,
  })
  @IsEmail({}, { message: 'Email must be a valid email address' })
  email: string;

  @ApiProperty({
    description: 'User password',
    example: 'SecurePassword123!',
    type: String,
    minLength: 8,
  })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  password: string;
}
