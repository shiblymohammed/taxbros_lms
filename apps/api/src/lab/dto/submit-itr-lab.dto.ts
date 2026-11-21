import { IsString, IsNotEmpty, IsNumber, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

/**
 * DTO for submitting Income Tax Return Lab form
 * 
 * Requirements: R29 (Income Tax Return Simulation)
 */
export class SubmitItrLabDto {
  @ApiProperty({
    description: 'Taxpayer name (fictional)',
    example: 'Sample Taxpayer',
  })
  @IsString()
  @IsNotEmpty()
  taxpayerName: string;

  @ApiProperty({
    description: 'PAN (fictional pattern only, e.g., TEST00000T)',
    example: 'TEST00000T',
  })
  @IsString()
  @IsNotEmpty()
  pan: string;

  @ApiProperty({
    description: 'Income source',
    example: 'Salary',
  })
  @IsString()
  @IsNotEmpty()
  incomeSource: string;

  @ApiProperty({
    description: 'Gross income amount',
    example: 800000,
  })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  grossIncome: number;

  @ApiProperty({
    description: 'Deductions amount',
    example: 150000,
  })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  deductions: number;
}
