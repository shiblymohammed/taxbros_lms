import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO for submitting GST Registration Lab form
 * 
 * Requirements: R28 (GST Registration Simulation)
 */
export class SubmitGstLabDto {
  @ApiProperty({
    description: 'Business name (fictional)',
    example: 'Test Business Pvt Ltd',
  })
  @IsString()
  @IsNotEmpty()
  businessName: string;

  @ApiProperty({
    description: 'Business type',
    example: 'Private Limited',
  })
  @IsString()
  @IsNotEmpty()
  businessType: string;

  @ApiProperty({
    description: 'PAN (fictional pattern only, e.g., TEST00000T)',
    example: 'TEST12345T',
  })
  @IsString()
  @IsNotEmpty()
  pan: string;

  @ApiProperty({
    description: 'Business address',
    example: '123 Fictional Street, Test City',
  })
  @IsString()
  @IsNotEmpty()
  address: string;

  @ApiProperty({
    description: 'Authorized signatory name',
    example: 'John Test',
  })
  @IsString()
  @IsNotEmpty()
  signatory: string;
}
