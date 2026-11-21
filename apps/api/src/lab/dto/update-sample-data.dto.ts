import { IsObject, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO for updating lab sample data
 * 
 * Requirements: R27 (Government Portal Lab Management)
 */
export class UpdateSampleDataDto {
  @ApiProperty({
    description: 'Sample data JSON object (structure depends on lab type)',
    example: {
      businessName: 'Sample Business',
      businessType: 'Proprietorship',
      pan: 'TEST00000T',
      address: '123 Sample Street',
      signatory: 'Sample Signatory',
    },
  })
  @IsObject()
  @IsNotEmpty()
  sampleData: Record<string, any>;
}
