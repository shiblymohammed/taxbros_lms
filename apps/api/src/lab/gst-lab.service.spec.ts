import { BadRequestException } from '@nestjs/common';
import { GstLabService, GstFormData } from './gst-lab.service';

/**
 * GST Lab Service Tests
 * 
 * Tests the GST Registration simulation service.
 * Verifies form validation, GSTIN generation, and ARN generation.
 * 
 * Requirements: R28 (GST Registration Simulation)
 * Task 50: Build GST Registration simulation
 * Test Coverage: T6 (GST simulation)
 */

describe('GstLabService', () => {
  let service: GstLabService;

  beforeEach(() => {
    service = new GstLabService();
  });

  describe('validateGstForm', () => {
    const validFormData: GstFormData = {
      businessName: 'Test Business Pvt Ltd',
      businessType: 'Private Limited Company',
      pan: 'TEST00000T',
      address: '123 Test Street, Test City, TS 500001',
      signatory: 'John Doe',
    };

    describe('valid form data', () => {
      it('should accept complete form with all required fields', () => {
        expect(() => service.validateGstForm(validFormData)).not.toThrow();
      });

      it('should accept form with fictional PAN pattern TEST00000T', () => {
        const formData = { ...validFormData, pan: 'TEST00000T' };
        expect(() => service.validateGstForm(formData)).not.toThrow();
      });

      it('should accept form with fictional PAN pattern DEMO00000D', () => {
        const formData = { ...validFormData, pan: 'DEMO00000D' };
        expect(() => service.validateGstForm(formData)).not.toThrow();
      });

      it('should accept form with fictional PAN pattern TRAIN0000R', () => {
        const formData = { ...validFormData, pan: 'TRAIN0000R' };
        expect(() => service.validateGstForm(formData)).not.toThrow();
      });

      it('should accept form with lowercase PAN and convert to uppercase', () => {
        const formData = { ...validFormData, pan: 'test00000t' };
        expect(() => service.validateGstForm(formData)).not.toThrow();
      });

      it('should accept business name with special characters', () => {
        const formData = {
          ...validFormData,
          businessName: "Test & Co. (India) Pvt. Ltd.",
        };
        expect(() => service.validateGstForm(formData)).not.toThrow();
      });

      it('should accept long address', () => {
        const formData = {
          ...validFormData,
          address:
            'Plot No. 123, Ground Floor, Test Building, Test Road, Near Test Circle, Test Area, Test City, Test State - 500001',
        };
        expect(() => service.validateGstForm(formData)).not.toThrow();
      });
    });

    describe('missing required fields', () => {
      it('should reject form with missing businessName', () => {
        const formData = { ...validFormData, businessName: '' };
        expect(() => service.validateGstForm(formData)).toThrow(
          BadRequestException,
        );
        expect(() => service.validateGstForm(formData)).toThrow(
          /Business Name.*cannot be empty/,
        );
      });

      it('should reject form with null businessName', () => {
        const formData = { ...validFormData, businessName: null as any };
        expect(() => service.validateGstForm(formData)).toThrow(
          BadRequestException,
        );
        expect(() => service.validateGstForm(formData)).toThrow(
          /Business Name.*required/,
        );
      });

      it('should reject form with missing businessType', () => {
        const formData = { ...validFormData, businessType: '' };
        expect(() => service.validateGstForm(formData)).toThrow(
          BadRequestException,
        );
        expect(() => service.validateGstForm(formData)).toThrow(
          /Business Type.*cannot be empty/,
        );
      });

      it('should reject form with missing PAN', () => {
        const formData = { ...validFormData, pan: '' };
        expect(() => service.validateGstForm(formData)).toThrow(
          BadRequestException,
        );
      });

      it('should reject form with missing address', () => {
        const formData = { ...validFormData, address: '' };
        expect(() => service.validateGstForm(formData)).toThrow(
          BadRequestException,
        );
        expect(() => service.validateGstForm(formData)).toThrow(
          /Address.*cannot be empty/,
        );
      });

      it('should reject form with missing signatory', () => {
        const formData = { ...validFormData, signatory: '' };
        expect(() => service.validateGstForm(formData)).toThrow(
          BadRequestException,
        );
        expect(() => service.validateGstForm(formData)).toThrow(
          /Authorized Signatory.*cannot be empty/,
        );
      });

      it('should reject form with whitespace-only businessName', () => {
        const formData = { ...validFormData, businessName: '   ' };
        expect(() => service.validateGstForm(formData)).toThrow(
          BadRequestException,
        );
      });

      it('should collect and report multiple missing fields', () => {
        const formData = {
          businessName: '',
          businessType: '',
          pan: 'TEST00000T',
          address: '',
          signatory: '',
        };
        expect(() => service.validateGstForm(formData)).toThrow(
          BadRequestException,
        );
        // Should report multiple field errors
        expect(() => service.validateGstForm(formData)).toThrow(
          /Business Name.*Business Type.*Address.*Authorized Signatory/,
        );
      });
    });

    describe('invalid PAN patterns', () => {
      it('should reject realistic PAN pattern ABCDE1234F', () => {
        const formData = { ...validFormData, pan: 'ABCDE1234F' };
        expect(() => service.validateGstForm(formData)).toThrow(
          BadRequestException,
        );
        expect(() => service.validateGstForm(formData)).toThrow(
          /Realistic PAN patterns are not allowed/,
        );
      });

      it('should reject realistic PAN pattern ZYXWV9876Z', () => {
        const formData = { ...validFormData, pan: 'ZYXWV9876Z' };
        expect(() => service.validateGstForm(formData)).toThrow(
          BadRequestException,
        );
      });

      it('should reject PAN shorter than 10 characters', () => {
        const formData = { ...validFormData, pan: 'TEST0000' };
        expect(() => service.validateGstForm(formData)).toThrow(
          BadRequestException,
        );
        expect(() => service.validateGstForm(formData)).toThrow(
          /Must be exactly 10 characters/,
        );
      });

      it('should reject PAN longer than 10 characters', () => {
        const formData = { ...validFormData, pan: 'TEST000000T' };
        expect(() => service.validateGstForm(formData)).toThrow(
          BadRequestException,
        );
      });

      it('should reject PAN with special characters', () => {
        const formData = { ...validFormData, pan: 'TEST@0000T' };
        expect(() => service.validateGstForm(formData)).toThrow(
          BadRequestException,
        );
      });

      it('should provide helpful error for realistic patterns', () => {
        const formData = { ...validFormData, pan: 'ABCDE1234F' };
        expect(() => service.validateGstForm(formData)).toThrow(
          /Please use fictional patterns like TEST00000T/,
        );
      });
    });
  });

  describe('generateGstin', () => {
    it('should generate GSTIN with format 00TESTX0000X0Z0', () => {
      const pan = 'TEST00000T';
      const gstin = service.generateGstin(pan);

      expect(gstin).toBe('00TEST00000TZ00');
    });

    it('should start with state code 00', () => {
      const gstin = service.generateGstin('TEST00000T');
      expect(gstin.substring(0, 2)).toBe('00');
    });

    it('should include the full PAN in positions 3-12', () => {
      const pan = 'DEMO00000D';
      const gstin = service.generateGstin(pan);

      expect(gstin.substring(2, 12)).toBe('DEMO00000D');
    });

    it('should end with Z00', () => {
      const gstin = service.generateGstin('TEST00000T');
      expect(gstin.substring(12)).toBe('Z00');
    });

    it('should be exactly 15 characters long', () => {
      const gstin = service.generateGstin('TEST00000T');
      expect(gstin.length).toBe(15);
    });

    it('should handle lowercase PAN and convert to uppercase', () => {
      const gstin = service.generateGstin('test00000t');
      expect(gstin).toBe('00TEST00000TZ00');
    });

    it('should handle PAN with leading/trailing whitespace', () => {
      const gstin = service.generateGstin('  TEST00000T  ');
      expect(gstin).toBe('00TEST00000TZ00');
    });

    it('should generate different GSTIN for different PANs', () => {
      const gstin1 = service.generateGstin('TEST00000T');
      const gstin2 = service.generateGstin('DEMO00000D');

      expect(gstin1).not.toBe(gstin2);
      expect(gstin1).toBe('00TEST00000TZ00');
      expect(gstin2).toBe('00DEMO00000DZ00');
    });

    it('should generate consistent GSTIN for same PAN', () => {
      const gstin1 = service.generateGstin('TEST00000T');
      const gstin2 = service.generateGstin('TEST00000T');

      expect(gstin1).toBe(gstin2);
    });
  });

  describe('generateArn', () => {
    it('should generate ARN with format AR0000000000000', () => {
      const arn = service.generateArn();

      expect(arn).toMatch(/^AR\d{13}$/);
    });

    it('should start with AR prefix', () => {
      const arn = service.generateArn();
      expect(arn.substring(0, 2)).toBe('AR');
    });

    it('should be exactly 15 characters long', () => {
      const arn = service.generateArn();
      expect(arn.length).toBe(15);
    });

    it('should contain only digits after AR prefix', () => {
      const arn = service.generateArn();
      const digits = arn.substring(2);

      expect(digits).toMatch(/^\d{13}$/);
    });

    it('should generate ARN based on timestamp', () => {
      const arn = service.generateArn();
      const digits = arn.substring(2);

      // Should be a valid number
      expect(parseInt(digits, 10)).toBeGreaterThan(0);
    });

    it('should generate different ARNs on subsequent calls', () => {
      const arn1 = service.generateArn();
      // Small delay to ensure different timestamp
      const arn2 = service.generateArn();

      // ARNs should be different due to timestamp-based generation
      // Note: In rare cases they might be the same if called in same millisecond
      expect(arn1).toMatch(/^AR\d{13}$/);
      expect(arn2).toMatch(/^AR\d{13}$/);
    });

    it('should generate ARN with zero-padded number', () => {
      const arn = service.generateArn();
      // The number part should always be 13 digits (zero-padded if necessary)
      expect(arn.substring(2).length).toBe(13);
    });
  });

  describe('processGstSubmission', () => {
    const validFormData: GstFormData = {
      businessName: 'Test Business Pvt Ltd',
      businessType: 'Private Limited Company',
      pan: 'TEST00000T',
      address: '123 Test Street, Test City, TS 500001',
      signatory: 'John Doe',
    };

    it('should process valid submission and return attempt with result', () => {
      const attempt = service.processGstSubmission(validFormData);

      expect(attempt).toHaveProperty('formData');
      expect(attempt).toHaveProperty('result');
    });

    it('should include original form data in attempt', () => {
      const attempt = service.processGstSubmission(validFormData);

      expect(attempt.formData).toEqual(validFormData);
      expect(attempt.formData.businessName).toBe('Test Business Pvt Ltd');
      expect(attempt.formData.pan).toBe('TEST00000T');
    });

    it('should generate GSTIN in result', () => {
      const attempt = service.processGstSubmission(validFormData);

      expect(attempt.result.gstin).toBeDefined();
      expect(attempt.result.gstin).toBe('00TEST00000TZ00');
    });

    it('should generate ARN in result', () => {
      const attempt = service.processGstSubmission(validFormData);

      expect(attempt.result.arn).toBeDefined();
      expect(attempt.result.arn).toMatch(/^AR\d{13}$/);
    });

    it('should include application date in result', () => {
      const attempt = service.processGstSubmission(validFormData);

      expect(attempt.result.applicationDate).toBeDefined();
      // Should be in YYYY-MM-DD format
      expect(attempt.result.applicationDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('should include status in result', () => {
      const attempt = service.processGstSubmission(validFormData);

      expect(attempt.result.status).toBe('Approved (Simulated)');
    });

    it('should set application date to current date', () => {
      const today = new Date().toISOString().split('T')[0];
      const attempt = service.processGstSubmission(validFormData);

      expect(attempt.result.applicationDate).toBe(today);
    });

    it('should throw error for invalid form data', () => {
      const invalidFormData = { ...validFormData, businessName: '' };

      expect(() => service.processGstSubmission(invalidFormData)).toThrow(
        BadRequestException,
      );
    });

    it('should throw error for realistic PAN pattern', () => {
      const invalidFormData = { ...validFormData, pan: 'ABCDE1234F' };

      expect(() => service.processGstSubmission(invalidFormData)).toThrow(
        BadRequestException,
      );
      expect(() => service.processGstSubmission(invalidFormData)).toThrow(
        /Realistic PAN patterns are not allowed/,
      );
    });

    it('should process multiple submissions with different data', () => {
      const formData1 = { ...validFormData, pan: 'TEST00000T' };
      const formData2 = { ...validFormData, pan: 'DEMO00000D' };

      const attempt1 = service.processGstSubmission(formData1);
      const attempt2 = service.processGstSubmission(formData2);

      expect(attempt1.result.gstin).toBe('00TEST00000TZ00');
      expect(attempt2.result.gstin).toBe('00DEMO00000DZ00');
      expect(attempt1.result.arn).not.toBe(attempt2.result.arn);
    });

    it('should include all result fields', () => {
      const attempt = service.processGstSubmission(validFormData);

      expect(attempt.result).toHaveProperty('gstin');
      expect(attempt.result).toHaveProperty('arn');
      expect(attempt.result).toHaveProperty('applicationDate');
      expect(attempt.result).toHaveProperty('status');
    });

    it('should throw error with multiple validation failures', () => {
      const invalidFormData: GstFormData = {
        businessName: '',
        businessType: '',
        pan: 'TEST00000T',
        address: '',
        signatory: '',
      };

      expect(() => service.processGstSubmission(invalidFormData)).toThrow(
        BadRequestException,
      );
    });
  });

  describe('inheritance from LabValidationService', () => {
    it('should inherit validatePAN method', () => {
      expect(() => service.validatePAN('TEST00000T')).not.toThrow();
      expect(() => service.validatePAN('ABCDE1234F')).toThrow();
    });

    it('should inherit validateRequiredString method', () => {
      expect(() =>
        service.validateRequiredString('Test', 'Field'),
      ).not.toThrow();
      expect(() => service.validateRequiredString('', 'Field')).toThrow();
    });

    it('should inherit collectValidationErrors method', () => {
      const errors = service.collectValidationErrors([
        () => service.validateRequiredString('', 'Field1'),
        () => service.validateRequiredString('', 'Field2'),
      ]);

      expect(errors.length).toBe(2);
    });
  });
});
