import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ItrLabService, ItrFormData } from './itr-lab.service';

/**
 * ITR Lab Service Unit Tests
 * 
 * Tests validation, tax calculation, and result generation for ITR simulation.
 * 
 * Requirements: R29
 * Task 51: Build Income Tax Return simulation
 */

describe('ItrLabService', () => {
  let service: ItrLabService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ItrLabService],
    }).compile();

    service = module.get<ItrLabService>(ItrLabService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getSampleData', () => {
    it('should return valid sample data', () => {
      const sampleData = service.getSampleData();
      
      expect(sampleData).toBeDefined();
      expect(sampleData.taxpayerName).toBe('Sample Taxpayer');
      expect(sampleData.pan).toBe('TEST00000T');
      expect(sampleData.incomeSource).toBe('Salary');
      expect(sampleData.grossIncome).toBe(800000);
      expect(sampleData.deductions).toBe(150000);
    });
  });

  describe('validateItrForm', () => {
    const validFormData: ItrFormData = {
      taxpayerName: 'John Doe',
      pan: 'TEST00000T',
      incomeSource: 'Salary',
      grossIncome: 600000,
      deductions: 50000,
    };

    it('should validate a valid form', () => {
      expect(() => service.validateItrForm(validFormData)).not.toThrow();
    });

    it('should reject empty taxpayer name', () => {
      const invalidData = { ...validFormData, taxpayerName: '' };
      
      expect(() => service.validateItrForm(invalidData)).toThrow(
        BadRequestException,
      );
      expect(() => service.validateItrForm(invalidData)).toThrow(
        /Taxpayer name cannot be empty/,
      );
    });

    it('should reject missing taxpayer name', () => {
      const invalidData = { ...validFormData, taxpayerName: undefined as any };
      
      expect(() => service.validateItrForm(invalidData)).toThrow(
        BadRequestException,
      );
    });

    it('should reject realistic PAN patterns', () => {
      const invalidData = { ...validFormData, pan: 'ABCDE1234F' };
      
      expect(() => service.validateItrForm(invalidData)).toThrow(
        BadRequestException,
      );
      expect(() => service.validateItrForm(invalidData)).toThrow(
        /Realistic PAN patterns are not allowed/,
      );
    });

    it('should accept fictional PAN with TEST prefix', () => {
      const validData = { ...validFormData, pan: 'TEST00000T' };
      
      expect(() => service.validateItrForm(validData)).not.toThrow();
    });

    it('should accept fictional PAN with DEMO prefix', () => {
      const validData = { ...validFormData, pan: 'DEMO00000D' };
      
      expect(() => service.validateItrForm(validData)).not.toThrow();
    });

    it('should accept fictional PAN with TRAIN prefix', () => {
      const validData = { ...validFormData, pan: 'TRAIN0000R' };
      
      expect(() => service.validateItrForm(validData)).not.toThrow();
    });

    it('should accept fictional PAN with LEARN prefix', () => {
      const validData = { ...validFormData, pan: 'LEARN0000L' };
      
      expect(() => service.validateItrForm(validData)).not.toThrow();
    });

    it('should reject PAN with invalid length', () => {
      const invalidData = { ...validFormData, pan: 'TEST000' };
      
      expect(() => service.validateItrForm(invalidData)).toThrow(
        BadRequestException,
      );
      expect(() => service.validateItrForm(invalidData)).toThrow(
        /Must be exactly 10 characters/,
      );
    });

    it('should reject empty income source', () => {
      const invalidData = { ...validFormData, incomeSource: '' };
      
      expect(() => service.validateItrForm(invalidData)).toThrow(
        BadRequestException,
      );
      expect(() => service.validateItrForm(invalidData)).toThrow(
        /Income source cannot be empty/,
      );
    });

    it('should reject negative gross income', () => {
      const invalidData = { ...validFormData, grossIncome: -1000 };
      
      expect(() => service.validateItrForm(invalidData)).toThrow(
        BadRequestException,
      );
      expect(() => service.validateItrForm(invalidData)).toThrow(
        /Gross income must be at least 0/,
      );
    });

    it('should reject negative deductions', () => {
      const invalidData = { ...validFormData, deductions: -500 };
      
      expect(() => service.validateItrForm(invalidData)).toThrow(
        BadRequestException,
      );
      expect(() => service.validateItrForm(invalidData)).toThrow(
        /Deductions must be at least 0/,
      );
    });

    it('should reject deductions exceeding gross income', () => {
      const invalidData = {
        ...validFormData,
        grossIncome: 100000,
        deductions: 150000,
      };
      
      expect(() => service.validateItrForm(invalidData)).toThrow(
        BadRequestException,
      );
      expect(() => service.validateItrForm(invalidData)).toThrow(
        /Deductions cannot exceed gross income/,
      );
    });

    it('should accept deductions equal to gross income', () => {
      const validData = {
        ...validFormData,
        grossIncome: 100000,
        deductions: 100000,
      };
      
      expect(() => service.validateItrForm(validData)).not.toThrow();
    });
  });

  describe('calculateTax', () => {
    it('should calculate zero tax for income below 2.5L after deductions', () => {
      const formData: ItrFormData = {
        taxpayerName: 'John Doe',
        pan: 'TEST00000T',
        incomeSource: 'Salary',
        grossIncome: 300000,
        deductions: 100000,
      };

      const calculation = service.calculateTax(formData);

      expect(calculation.grossIncome).toBe(300000);
      expect(calculation.deductions).toBe(100000);
      expect(calculation.taxableIncome).toBe(200000);
      expect(calculation.taxAmount).toBe(0);
      expect(calculation.taxBrackets).toHaveLength(0);
    });

    it('should calculate 5% tax for income between 2.5L and 5L', () => {
      const formData: ItrFormData = {
        taxpayerName: 'John Doe',
        pan: 'TEST00000T',
        incomeSource: 'Salary',
        grossIncome: 400000,
        deductions: 50000,
      };

      const calculation = service.calculateTax(formData);

      // Taxable income: 350000
      // Tax: 5% on (350000 - 250000) = 5% on 100000 = 5000
      expect(calculation.taxableIncome).toBe(350000);
      expect(calculation.taxAmount).toBe(5000);
      expect(calculation.taxBrackets).toHaveLength(1);
      expect(calculation.taxBrackets[0].rate).toBe(5);
      expect(calculation.taxBrackets[0].taxOnBracket).toBe(5000);
    });

    it('should calculate tax across multiple brackets (2.5L - 5L)', () => {
      const formData: ItrFormData = {
        taxpayerName: 'Jane Smith',
        pan: 'DEMO00000D',
        incomeSource: 'Business',
        grossIncome: 600000,
        deductions: 50000,
      };

      const calculation = service.calculateTax(formData);

      // Taxable income: 550000
      // Tax:
      // - 0% on first 250000 = 0
      // - 5% on next 250000 (250000 to 500000) = 12500
      // - 20% on next 50000 (500000 to 550000) = 10000
      // Total: 22500
      expect(calculation.taxableIncome).toBe(550000);
      expect(calculation.taxAmount).toBe(22500);
      expect(calculation.taxBrackets).toHaveLength(2);
    });

    it('should calculate tax across all brackets for high income', () => {
      const formData: ItrFormData = {
        taxpayerName: 'Rich Person',
        pan: 'TRAIN0000R',
        incomeSource: 'Salary',
        grossIncome: 1500000,
        deductions: 100000,
      };

      const calculation = service.calculateTax(formData);

      // Taxable income: 1400000
      // Tax:
      // - 0% on first 250000 = 0
      // - 5% on next 250000 (250000 to 500000) = 12500
      // - 20% on next 500000 (500000 to 1000000) = 100000
      // - 30% on next 400000 (1000000 to 1400000) = 120000
      // Total: 232500
      expect(calculation.taxableIncome).toBe(1400000);
      expect(calculation.taxAmount).toBe(232500);
      expect(calculation.taxBrackets).toHaveLength(3);
    });

    it('should handle zero deductions', () => {
      const formData: ItrFormData = {
        taxpayerName: 'No Deductions',
        pan: 'TEST00000T',
        incomeSource: 'Freelancing',
        grossIncome: 300000,
        deductions: 0,
      };

      const calculation = service.calculateTax(formData);

      // Taxable income: 300000
      // Tax: 5% on (300000 - 250000) = 5% on 50000 = 2500
      expect(calculation.taxableIncome).toBe(300000);
      expect(calculation.taxAmount).toBe(2500);
    });

    it('should handle deductions equal to gross income', () => {
      const formData: ItrFormData = {
        taxpayerName: 'Full Deduction',
        pan: 'TEST00000T',
        incomeSource: 'Salary',
        grossIncome: 500000,
        deductions: 500000,
      };

      const calculation = service.calculateTax(formData);

      expect(calculation.taxableIncome).toBe(0);
      expect(calculation.taxAmount).toBe(0);
      expect(calculation.taxBrackets).toHaveLength(0);
    });

    it('should round tax amounts to nearest integer', () => {
      const formData: ItrFormData = {
        taxpayerName: 'Rounding Test',
        pan: 'TEST00000T',
        incomeSource: 'Salary',
        grossIncome: 251000,
        deductions: 0,
      };

      const calculation = service.calculateTax(formData);

      // Taxable income: 251000
      // Tax: 5% on 1000 = 50
      expect(calculation.taxAmount).toBe(50);
      expect(Number.isInteger(calculation.taxAmount)).toBe(true);
    });
  });

  describe('generateAcknowledgementNumber', () => {
    it('should generate 15-digit acknowledgement number', () => {
      const ackNumber = service.generateAcknowledgementNumber();

      expect(ackNumber).toBeDefined();
      expect(ackNumber).toHaveLength(15);
      expect(/^\d{15}$/.test(ackNumber)).toBe(true);
    });

    it('should generate unique acknowledgement numbers', () => {
      const ackNumber1 = service.generateAcknowledgementNumber();
      const ackNumber2 = service.generateAcknowledgementNumber();

      // While there's a tiny chance they could be the same,
      // practically they should be different
      expect(ackNumber1).not.toBe(ackNumber2);
    });

    it('should generate acknowledgement numbers with only digits', () => {
      const ackNumber = service.generateAcknowledgementNumber();

      for (const char of ackNumber) {
        expect(/\d/.test(char)).toBe(true);
      }
    });
  });

  describe('submitItrForm', () => {
    const validFormData: ItrFormData = {
      taxpayerName: 'Test Taxpayer',
      pan: 'TEST00000T',
      incomeSource: 'Salary',
      grossIncome: 800000,
      deductions: 150000,
    };

    it('should successfully submit a valid ITR form', () => {
      const result = service.submitItrForm(validFormData);

      expect(result).toBeDefined();
      expect(result.formData).toEqual(validFormData);
      expect(result.calculation).toBeDefined();
      expect(result.result).toBeDefined();
    });

    it('should include form data in submission result', () => {
      const result = service.submitItrForm(validFormData);

      expect(result.formData.taxpayerName).toBe('Test Taxpayer');
      expect(result.formData.pan).toBe('TEST00000T');
      expect(result.formData.incomeSource).toBe('Salary');
      expect(result.formData.grossIncome).toBe(800000);
      expect(result.formData.deductions).toBe(150000);
    });

    it('should include calculation in submission result', () => {
      const result = service.submitItrForm(validFormData);

      expect(result.calculation.grossIncome).toBe(800000);
      expect(result.calculation.deductions).toBe(150000);
      expect(result.calculation.taxableIncome).toBe(650000);
      expect(result.calculation.taxAmount).toBeGreaterThan(0);
      expect(result.calculation.taxBrackets).toBeDefined();
    });

    it('should generate acknowledgement number in result', () => {
      const result = service.submitItrForm(validFormData);

      expect(result.result.acknowledgementNumber).toBeDefined();
      expect(result.result.acknowledgementNumber).toHaveLength(15);
      expect(/^\d{15}$/.test(result.result.acknowledgementNumber)).toBe(true);
    });

    it('should include taxpayer details in result', () => {
      const result = service.submitItrForm(validFormData);

      expect(result.result.taxpayerName).toBe('Test Taxpayer');
      expect(result.result.pan).toBe('TEST00000T');
      expect(result.result.taxableIncome).toBe(650000);
      expect(result.result.taxAmount).toBeDefined();
    });

    it('should set filing date in result', () => {
      const result = service.submitItrForm(validFormData);

      expect(result.result.filingDate).toBeDefined();
      expect(result.result.filingDate).toBeInstanceOf(Date);
    });

    it('should set status to FILED in result', () => {
      const result = service.submitItrForm(validFormData);

      expect(result.result.status).toBe('FILED');
    });

    it('should uppercase PAN in result', () => {
      const formData = { ...validFormData, pan: 'test00000t' };
      const result = service.submitItrForm(formData);

      expect(result.result.pan).toBe('TEST00000T');
    });

    it('should reject invalid form data', () => {
      const invalidData = { ...validFormData, pan: 'ABCDE1234F' };

      expect(() => service.submitItrForm(invalidData)).toThrow(
        BadRequestException,
      );
    });

    it('should handle different income levels correctly', () => {
      const lowIncomeData: ItrFormData = {
        taxpayerName: 'Low Income',
        pan: 'TEST00000T',
        incomeSource: 'Salary',
        grossIncome: 200000,
        deductions: 0,
      };

      const result = service.submitItrForm(lowIncomeData);

      expect(result.calculation.taxAmount).toBe(0);
      expect(result.result.taxAmount).toBe(0);
    });

    it('should calculate correct tax for complex scenario', () => {
      const complexData: ItrFormData = {
        taxpayerName: 'Complex Taxpayer',
        pan: 'DEMO00000D',
        incomeSource: 'Multiple Sources',
        grossIncome: 1200000,
        deductions: 200000,
      };

      const result = service.submitItrForm(complexData);

      // Taxable income: 1000000
      // Tax:
      // - 0% on first 250000 = 0
      // - 5% on next 250000 = 12500
      // - 20% on next 500000 = 100000
      // Total: 112500
      expect(result.calculation.taxableIncome).toBe(1000000);
      expect(result.calculation.taxAmount).toBe(112500);
      expect(result.result.taxAmount).toBe(112500);
    });
  });

  describe('integration scenarios', () => {
    it('should handle end-to-end ITR filing workflow', () => {
      // Step 1: Get sample data
      const sampleData = service.getSampleData();
      expect(sampleData).toBeDefined();

      // Step 2: Modify sample data
      const formData: ItrFormData = {
        ...sampleData,
        taxpayerName: 'Real User Name',
        grossIncome: 750000,
      };

      // Step 3: Submit form
      const result = service.submitItrForm(formData);

      // Step 4: Verify complete result
      expect(result.formData).toBeDefined();
      expect(result.calculation).toBeDefined();
      expect(result.result).toBeDefined();
      expect(result.result.acknowledgementNumber).toHaveLength(15);
      expect(result.result.status).toBe('FILED');
    });

    it('should handle validation errors gracefully', () => {
      const invalidData: ItrFormData = {
        taxpayerName: '',
        pan: 'INVALID',
        incomeSource: 'Salary',
        grossIncome: -1000,
        deductions: 500,
      };

      expect(() => service.submitItrForm(invalidData)).toThrow(
        BadRequestException,
      );
    });

    it('should produce consistent results for same input', () => {
      const formData: ItrFormData = {
        taxpayerName: 'Consistent User',
        pan: 'TEST00000T',
        incomeSource: 'Salary',
        grossIncome: 600000,
        deductions: 50000,
      };

      const result1 = service.submitItrForm(formData);
      const result2 = service.submitItrForm(formData);

      // Tax calculation should be identical
      expect(result1.calculation.taxAmount).toBe(result2.calculation.taxAmount);
      expect(result1.calculation.taxableIncome).toBe(
        result2.calculation.taxableIncome,
      );

      // Acknowledgement numbers should be different
      expect(result1.result.acknowledgementNumber).not.toBe(
        result2.result.acknowledgementNumber,
      );
    });
  });
});
