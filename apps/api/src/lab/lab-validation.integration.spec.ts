import { LabValidationService } from './lab-validation.service';

/**
 * Lab Validation Integration Tests
 * 
 * Demonstrates how specific lab services (GST, ITR, MCA) can extend
 * and use the base LabValidationService for form validation.
 * 
 * Requirements: R28, R29, R30
 * Task 49: Implement shared lab validation framework
 */

describe('LabValidationService Integration', () => {
  let service: LabValidationService;

  beforeEach(() => {
    service = new LabValidationService();
  });

  describe('GST Registration Form Validation', () => {
    it('should validate a complete fictional GST registration form', () => {
      const formData = {
        businessName: 'Test Business Pvt Ltd',
        businessType: 'Private Limited Company',
        pan: 'TEST00000T',
        address: '123 Test Street',
        city: 'Test City',
        state: 'Test State',
        pincode: '123456',
        authorizedSignatory: 'John Doe',
        email: 'test@example.com',
        phone: '+919876543210',
      };

      const errors = service.collectValidationErrors([
        () => service.validateRequiredString(formData.businessName, 'Business Name'),
        () => service.validateRequiredString(formData.businessType, 'Business Type'),
        () => service.validatePAN(formData.pan),
        () => service.validateRequiredString(formData.address, 'Address'),
        () => service.validateRequiredString(formData.city, 'City'),
        () => service.validateRequiredString(formData.state, 'State'),
        () => service.validateRequiredString(formData.pincode, 'Pincode'),
        () => service.validateRequiredString(formData.authorizedSignatory, 'Authorized Signatory'),
        () => service.validateEmail(formData.email, 'Email'),
        () => service.validatePhone(formData.phone, 'Phone'),
      ]);

      expect(errors).toHaveLength(0);
    });

    it('should reject GST form with realistic PAN', () => {
      const formData = {
        businessName: 'Real Business Pvt Ltd',
        pan: 'ABCDE1234F', // Realistic pattern
      };

      const errors = service.collectValidationErrors([
        () => service.validateRequiredString(formData.businessName, 'Business Name'),
        () => service.validatePAN(formData.pan),
      ]);

      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain('Realistic PAN patterns are not allowed');
    });

    it('should reject GST form with missing required fields', () => {
      const formData = {
        businessName: '',
        pan: 'TEST00000T',
        email: 'invalid-email',
      };

      const errors = service.collectValidationErrors([
        () => service.validateRequiredString(formData.businessName, 'Business Name'),
        () => service.validatePAN(formData.pan),
        () => service.validateEmail(formData.email, 'Email'),
      ]);

      expect(errors).toHaveLength(2);
      expect(errors.find(e => e.message.includes('Business Name'))).toBeDefined();
      expect(errors.find(e => e.message.includes('Email'))).toBeDefined();
    });
  });

  describe('ITR Filing Form Validation', () => {
    it('should validate a complete fictional ITR form', () => {
      const formData = {
        taxpayerName: 'Test Taxpayer',
        pan: 'DEMO00000D',
        incomeSource: 'Salary',
        grossIncome: 500000,
        deductions: 50000,
      };

      const errors = service.collectValidationErrors([
        () => service.validateRequiredString(formData.taxpayerName, 'Taxpayer Name'),
        () => service.validatePAN(formData.pan),
        () => service.validateRequiredString(formData.incomeSource, 'Income Source'),
        () => service.validateRequiredNumber(formData.grossIncome, 'Gross Income', { min: 0 }),
        () => service.validateRequiredNumber(formData.deductions, 'Deductions', { min: 0 }),
      ]);

      expect(errors).toHaveLength(0);
    });

    it('should reject ITR form with negative income', () => {
      const formData = {
        taxpayerName: 'Test Taxpayer',
        pan: 'TEST00000T',
        grossIncome: -100000, // Invalid negative
        deductions: 50000,
      };

      const errors = service.collectValidationErrors([
        () => service.validateRequiredString(formData.taxpayerName, 'Taxpayer Name'),
        () => service.validatePAN(formData.pan),
        () => service.validateRequiredNumber(formData.grossIncome, 'Gross Income', { min: 0 }),
        () => service.validateRequiredNumber(formData.deductions, 'Deductions', { min: 0 }),
      ]);

      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain('must be at least 0');
    });
  });

  describe('MCA Incorporation Form Validation', () => {
    it('should validate a complete fictional MCA incorporation form', () => {
      const formData = {
        companyName: 'Test Company Private Limited',
        directors: [
          {
            name: 'Director One',
            din: 'TEST0001',
            email: 'director1@test.com',
          },
          {
            name: 'Director Two',
            din: 'TEST0002',
            email: 'director2@test.com',
          },
        ],
        registeredAddress: '456 Test Avenue',
        authorizedCapital: 1000000,
      };

      const errors = service.collectValidationErrors([
        () => service.validateRequiredString(formData.companyName, 'Company Name'),
        () => service.validateRequiredArray(formData.directors, 'Directors', 1),
        () => service.validateRequiredString(formData.registeredAddress, 'Registered Address'),
        () => service.validateRequiredNumber(formData.authorizedCapital, 'Authorized Capital', { min: 0 }),
        // Validate each director
        ...formData.directors.flatMap((director, index) => [
          () => service.validateRequiredString(director.name, `Director ${index + 1} Name`),
          () => service.validateDIN(director.din),
          () => service.validateEmail(director.email, `Director ${index + 1} Email`),
        ]),
      ]);

      expect(errors).toHaveLength(0);
    });

    it('should reject MCA form with realistic DIN', () => {
      const formData = {
        companyName: 'Real Company Ltd',
        directors: [
          {
            name: 'Real Director',
            din: '01234567', // Realistic pattern (all digits)
          },
        ],
      };

      const errors = service.collectValidationErrors([
        () => service.validateRequiredString(formData.companyName, 'Company Name'),
        () => service.validateRequiredArray(formData.directors, 'Directors', 1),
        ...formData.directors.flatMap((director, index) => [
          () => service.validateRequiredString(director.name, `Director ${index + 1} Name`),
          () => service.validateDIN(director.din),
        ]),
      ]);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors.find(e => e.message.includes('Realistic DIN'))).toBeDefined();
    });

    it('should reject MCA form with no directors', () => {
      const formData = {
        companyName: 'Test Company Ltd',
        directors: [], // Empty array
      };

      const errors = service.collectValidationErrors([
        () => service.validateRequiredString(formData.companyName, 'Company Name'),
        () => service.validateRequiredArray(formData.directors, 'Directors', 1),
      ]);

      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain('must contain at least 1 item');
    });
  });

  describe('Example Lab Service Extension', () => {
    // This demonstrates how a specific lab service would extend the base validation service

    class GstLabService extends LabValidationService {
      validateGstForm(formData: any): { isValid: boolean; errors: any[] } {
        const errors = this.collectValidationErrors([
          () => this.validateRequiredString(formData.businessName, 'Business Name'),
          () => this.validateRequiredString(formData.businessType, 'Business Type'),
          () => this.validatePAN(formData.pan),
          () => this.validateRequiredString(formData.address, 'Address'),
          () => this.validateRequiredString(formData.city, 'City'),
          () => this.validateRequiredString(formData.state, 'State'),
          () => this.validateRequiredString(formData.pincode, 'Pincode'),
          () => this.validateEmail(formData.email, 'Email'),
          () => this.validatePhone(formData.phone, 'Phone'),
        ]);

        return {
          isValid: errors.length === 0,
          errors,
        };
      }
    }

    it('should use extended GST service for validation', () => {
      const gstService = new GstLabService();

      const validForm = {
        businessName: 'Test Business',
        businessType: 'Private Limited',
        pan: 'TEST00000T',
        address: '123 Street',
        city: 'City',
        state: 'State',
        pincode: '123456',
        email: 'test@example.com',
        phone: '9876543210',
      };

      const result = gstService.validateGstForm(validForm);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return validation errors from extended service', () => {
      const gstService = new GstLabService();

      const invalidForm = {
        businessName: '',
        businessType: 'Private Limited',
        pan: 'ABCDE1234F', // Realistic PAN
        address: '123 Street',
        city: '',
        state: 'State',
        pincode: '123456',
        email: 'invalid-email',
        phone: '123', // Invalid phone
      };

      const result = gstService.validateGstForm(invalidForm);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      
      // Check specific errors
      expect(result.errors.find(e => e.message.includes('Business Name'))).toBeDefined();
      expect(result.errors.find(e => e.message.includes('Realistic PAN'))).toBeDefined();
      expect(result.errors.find(e => e.message.includes('City'))).toBeDefined();
      expect(result.errors.find(e => e.message.includes('Email'))).toBeDefined();
      expect(result.errors.find(e => e.message.includes('Phone'))).toBeDefined();
    });
  });
});
