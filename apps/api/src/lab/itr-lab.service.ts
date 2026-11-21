import { Injectable, BadRequestException } from '@nestjs/common';
import { LabValidationService } from './lab-validation.service';

/**
 * Income Tax Return Lab Service
 * 
 * Implements ITR simulation extending LabValidationService.
 * Provides form validation, simplified tax calculation, and acknowledgement generation.
 * 
 * Requirements: R29
 * Task 51: Build Income Tax Return simulation
 */

export interface ItrFormData {
  taxpayerName: string;
  pan: string;
  incomeSource: string;
  grossIncome: number;
  deductions: number;
}

export interface ItrCalculation {
  grossIncome: number;
  deductions: number;
  taxableIncome: number;
  taxAmount: number;
  taxBrackets: TaxBracket[];
}

export interface TaxBracket {
  from: number;
  to: number | null;
  rate: number;
  taxOnBracket: number;
}

export interface ItrResult {
  acknowledgementNumber: string;
  taxpayerName: string;
  pan: string;
  taxableIncome: number;
  taxAmount: number;
  filingDate: Date;
  status: string;
}

export interface ItrAttemptData {
  formData: ItrFormData;
  calculation: ItrCalculation;
  result: ItrResult;
}

@Injectable()
export class ItrLabService extends LabValidationService {
  /**
   * Tax brackets for simplified tax calculation
   * Using fictional simplified brackets for training purposes
   */
  private readonly TAX_BRACKETS: Array<{
    from: number;
    to: number | null;
    rate: number;
  }> = [
    { from: 0, to: 250000, rate: 0 },        // No tax up to 2.5L
    { from: 250000, to: 500000, rate: 5 },   // 5% on 2.5L - 5L
    { from: 500000, to: 1000000, rate: 20 }, // 20% on 5L - 10L
    { from: 1000000, to: null, rate: 30 },   // 30% on income > 10L
  ];

  /**
   * Validate ITR form data
   * 
   * Validates all required fields and ensures fictional PAN pattern.
   * 
   * @param formData - The ITR form data to validate
   * @returns true if valid, throws BadRequestException if invalid
   */
  validateItrForm(formData: ItrFormData): boolean {
    // Validate taxpayer name
    this.validateRequiredString(formData.taxpayerName, 'Taxpayer name');

    // Validate PAN (rejects realistic patterns, accepts fictional)
    this.validatePAN(formData.pan);

    // Validate income source
    this.validateRequiredString(formData.incomeSource, 'Income source');

    // Validate gross income
    this.validateRequiredNumber(formData.grossIncome, 'Gross income', {
      min: 0,
    });

    // Validate deductions
    this.validateRequiredNumber(formData.deductions, 'Deductions', {
      min: 0,
    });

    // Ensure deductions don't exceed gross income
    if (formData.deductions > formData.grossIncome) {
      throw new BadRequestException(
        'Deductions cannot exceed gross income',
      );
    }

    return true;
  }

  /**
   * Calculate tax using simplified brackets
   * 
   * Calculates tax liability based on taxable income (gross - deductions)
   * using the simplified bracket system.
   * 
   * @param formData - The ITR form data
   * @returns Tax calculation with breakdown
   */
  calculateTax(formData: ItrFormData): ItrCalculation {
    const taxableIncome = formData.grossIncome - formData.deductions;
    let remainingIncome = taxableIncome;
    let totalTax = 0;
    const taxBrackets: TaxBracket[] = [];

    // Calculate tax for each bracket
    for (let i = 0; i < this.TAX_BRACKETS.length; i++) {
      const bracket = this.TAX_BRACKETS[i];
      
      // Skip if no income left to tax
      if (remainingIncome <= 0) {
        break;
      }

      // Skip brackets below taxable income
      if (taxableIncome <= bracket.from) {
        continue;
      }

      // Calculate income in this bracket
      let incomeInBracket: number;
      if (bracket.to === null) {
        // Top bracket - all remaining income
        incomeInBracket = remainingIncome;
      } else {
        // Calculate how much falls in this bracket
        const bracketLimit = bracket.to - bracket.from;
        incomeInBracket = Math.min(remainingIncome, bracketLimit);
      }

      // Calculate tax for this bracket
      const taxOnBracket = (incomeInBracket * bracket.rate) / 100;
      totalTax += taxOnBracket;
      remainingIncome -= incomeInBracket;

      // Record only brackets that attract tax (the 0% slab is omitted)
      if (bracket.rate > 0) taxBrackets.push({
        from: bracket.from,
        to: bracket.to,
        rate: bracket.rate,
        taxOnBracket: Math.round(taxOnBracket),
      });
    }

    return {
      grossIncome: formData.grossIncome,
      deductions: formData.deductions,
      taxableIncome: taxableIncome,
      taxAmount: Math.round(totalTax),
      taxBrackets: taxBrackets,
    };
  }

  /**
   * Generate simulated acknowledgement number
   * 
   * Format: 15 digits (e.g., 123456789012345)
   * 
   * @returns Fictional acknowledgement number
   */
  generateAcknowledgementNumber(): string {
    // Generate 15 random digits
    let ackNumber = '';
    for (let i = 0; i < 15; i++) {
      ackNumber += Math.floor(Math.random() * 10).toString();
    }
    return ackNumber;
  }

  /**
   * Submit ITR form and generate result
   * 
   * Validates form, calculates tax, generates acknowledgement,
   * and returns complete attempt data.
   * 
   * @param formData - The ITR form data
   * @returns Complete attempt data with calculation and result
   */
  submitItrForm(formData: ItrFormData): ItrAttemptData {
    // Validate form data
    this.validateItrForm(formData);

    // Calculate tax
    const calculation = this.calculateTax(formData);

    // Generate simulated result
    const result: ItrResult = {
      acknowledgementNumber: this.generateAcknowledgementNumber(),
      taxpayerName: formData.taxpayerName,
      pan: formData.pan.trim().toUpperCase(),
      taxableIncome: calculation.taxableIncome,
      taxAmount: calculation.taxAmount,
      filingDate: new Date(),
      status: 'FILED',
    };

    return {
      formData,
      calculation,
      result,
    };
  }

  /**
   * Get sample ITR data for training
   * 
   * Returns fictional sample data to help students understand the form.
   * 
   * @returns Sample ITR form data
   */
  getSampleData(): ItrFormData {
    return {
      taxpayerName: 'Sample Taxpayer',
      pan: 'TEST00000T',
      incomeSource: 'Salary',
      grossIncome: 800000,
      deductions: 150000,
    };
  }
}
