import {
  IsString,
  IsNotEmpty,
  IsNumber,
  Min,
  IsArray,
  ValidateNested,
  IsEmail,
  IsOptional,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

/**
 * DTO for director information in MCA Lab
 */
export class DirectorDto {
  @ApiProperty({
    description: 'Director name',
    example: 'John Director',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: 'DIN (fictional pattern only, e.g., 00000000)',
    example: '00000001',
  })
  @IsString()
  @IsNotEmpty()
  din: string;

  @ApiProperty({
    description: 'Director email',
    example: 'director@example.com',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    description: 'Director address (optional)',
    example: '123 Test Street',
    required: false,
  })
  @IsString()
  @IsOptional()
  address?: string;
}

/**
 * DTO for submitting MCA Incorporation Lab form
 * 
 * Requirements: R30 (MCA Incorporation Simulation)
 */
export class SubmitMcaLabDto {
  @ApiProperty({
    description: 'Company name',
    example: 'Test Company Private Limited',
  })
  @IsString()
  @IsNotEmpty()
  companyName: string;

  @ApiProperty({
    description: 'Array of directors (at least 1 required)',
    type: [DirectorDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DirectorDto)
  directors: DirectorDto[];

  @ApiProperty({
    description: 'Registered office address',
    example: '123 Fictional Street, Test City',
  })
  @IsString()
  @IsNotEmpty()
  registeredAddress: string;

  @ApiProperty({
    description: 'Authorized capital amount',
    example: 100000,
  })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  authorizedCapital: number;

  @ApiProperty({
    description: 'City (optional)',
    example: 'Test City',
    required: false,
  })
  @IsString()
  @IsOptional()
  city?: string;

  @ApiProperty({
    description: 'State (optional)',
    example: 'Test State',
    required: false,
  })
  @IsString()
  @IsOptional()
  state?: string;

  @ApiProperty({
    description: 'Pincode (optional)',
    example: '000000',
    required: false,
  })
  @IsString()
  @IsOptional()
  pincode?: string;
}
