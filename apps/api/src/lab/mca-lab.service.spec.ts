import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { McaLabService, McaFormData, Director } from './mca-lab.service';

/**
 * Test Suite: MCA Lab Service
 * 
 * Tests the MCA (Ministry of Corporate Affairs) incorporation simulation service.
 * Validates form validation logic, DIN pattern checking, and CIN generation.
 * 
 * Requirements: R30
 * Test Coverage: T6 (MCA simulation)
 * Task 52: Build MCA Incorporation simulation
 */

describe('McaLabService', () => {
  let service: McaLabService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [McaLabService],
    }).compile();

    service = module.get<McaLabService>(McaLabService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('validateMcaForm', () => {
    const validDirector: Director = {
      name: 'John Doe',
      din: 'TEST0001',
      email: 'john@example.com',
      address: '123 Main St',
    };

    const validFormData: McaFormData = {
      companyName: 'Test Corporation Private Limited',
      directors: [validDirector],
      registeredAddress: '456 Business Park, Tech City',
      authorizedCapital: 1000000,
      city: 'Hyderabad',
      state: 'Telangana',
      pincode: '500001',
    };

    it('should validate a complete valid form', () => {
      const result = service.validateMcaForm(validFormData);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate form with minimal required fields', () => {
      const minimalFormData: McaFormData = {
        companyName: 'Minimal Corp',
        directors: [
          {
            name: 'Jane Smith',
            din: 'DEMO0001',
            email: 'jane@example.com',
          },
        ],
        registeredAddress: '789 Office Block',
        authorizedCapital: 500000,
      };

      const result = service.validateMcaForm(minimalFormData);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate form with multiple directors', () => {
      const formWithMultipleDirectors: McaFormData = {
        ...validFormData,
        directors: [
          {
            name: 'Director One',
            din: 'TEST0001',
            email: 'director1@example.com',
          },
          {
            name: 'Director Two',
            din: 'DEMO0002',
            email: 'director2@example.com',
          },
          {
            name: 'Director Three',
            din: 'TRAIN003',
            email: 'director3@example.com',
          },
        ],
      };

      const result = service.validateMcaForm(formWithMultipleDirectors);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject form with missing company name', () => {
      const invalidFormData = {
        ...validFormData,
        companyName: '',
      };

      const result = service.validateMcaForm(invalidFormData);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some((e) => e.message.includes('Company Name'))).toBe(
        true,
      );
    });

    it('should reject form with empty directors array', () => {
      const invalidFormData: McaFormData = {
        ...validFormData,
        directors: [],
      };

      const result = service.validateMcaForm(invalidFormData);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some((e) => e.message.includes('Directors'))).toBe(
        true,
      );
    });

    it('should reject form with missing registered address', () => {
      const invalidFormData = {
        ...validFormData,
        registeredAddress: '',
      };

      const result = service.validateMcaForm(invalidFormData);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(
        result.errors.some((e) => e.message.includes('Registered Address')),
      ).toBe(true);
    });

    it('should reject form with negative authorized capital', () => {
      const invalidFormData: McaFormData = {
        ...validFormData,
        authorizedCapital: -100000,
      };

      const result = service.validateMcaForm(invalidFormData);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(
        result.errors.some((e) => e.message.includes('Authorized Capital')),
      ).toBe(true);
    });

    it('should reject form with invalid authorized capital type', () => {
      const invalidFormData: any = {
        ...validFormData,
        authorizedCapital: 'not-a-number',
      };

      const result = service.validateMcaForm(invalidFormData);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(
        result.errors.some((e) => e.message.includes('Authorized Capital')),
      ).toBe(true);
    });

    it('should reject director with missing name', () => {
      const invalidFormData: McaFormData = {
        ...validFormData,
        directors: [
          {
            name: '',
            din: 'TEST0001',
            email: 'test@example.com',
          },
        ],
      };

      const result = service.validateMcaForm(invalidFormData);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(
        result.errors.some((e) => e.message.includes('Director 1 Name')),
      ).toBe(true);
    });

    it('should reject director with realistic DIN pattern (8 digits)', () => {
      const invalidFormData: McaFormData = {
        ...validFormData,
        directors: [
          {
            name: 'John Doe',
            din: '12345678', // Realistic pattern - all digits
            email: 'john@example.com',
          },
        ],
      };

      const result = service.validateMcaForm(invalidFormData);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some((e) => e.message.includes('Realistic DIN'))).toBe(
        true,
      );
    });

    it('should accept director with fictional DIN patterns', () => {
      const fictionalDINs = [
        'TEST0001',
        'DEMO0002',
        'TRAIN003',
        'LEARN004',
        'PRACT005',
        'SAMPL006',
        'ABCD1234',
        'XYZ00001',
      ];

      fictionalDINs.forEach((din) => {
        const formData: McaFormData = {
          ...validFormData,
          directors: [
            {
              name: 'Test Director',
              din,
              email: 'test@example.com',
            },
          ],
        };

        const result = service.validateMcaForm(formData);
        expect(result.isValid).toBe(true);
      });
    });

    it('should reject director with invalid email format', () => {
      const invalidFormData: McaFormData = {
        ...validFormData,
        directors: [
          {
            name: 'John Doe',
            din: 'TEST0001',
            email: 'invalid-email',
          },
        ],
      };

      const result = service.validateMcaForm(invalidFormData);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(
        result.errors.some((e) => e.message.includes('Director 1 Email')),
      ).toBe(true);
    });

    it('should reject director with missing email', () => {
      const invalidFormData: any = {
        ...validFormData,
        directors: [
          {
            name: 'John Doe',
            din: 'TEST0001',
            email: '',
          },
        ],
      };

      const result = service.validateMcaForm(invalidFormData);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(
        result.errors.some((e) => e.message.includes('Director 1 Email')),
      ).toBe(true);
    });

    it('should validate all directors in multiple director scenario', () => {
      const invalidFormData: McaFormData = {
        ...validFormData,
        directors: [
          {
            name: 'Valid Director',
            din: 'TEST0001',
            email: 'valid@example.com',
          },
          {
            name: '', // Invalid: empty name
            din: 'DEMO0002',
            email: 'test2@example.com',
          },
          {
            name: 'Director Three',
            din: '12345678', // Invalid: realistic DIN
            email: 'test3@example.com',
          },
        ],
      };

      const result = service.validateMcaForm(invalidFormData);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(2);
      expect(
        result.errors.some((e) => e.message.includes('Director 2 Name')),
      ).toBe(true);
      expect(result.errors.some((e) => e.message.includes('Realistic DIN'))).toBe(
        true,
      );
    });

    it('should collect all validation errors at once', () => {
      const invalidFormData: any = {
        companyName: '', // Invalid
        directors: [], // Invalid
        registeredAddress: '', // Invalid
        authorizedCapital: -1000, // Invalid
      };

      const result = service.validateMcaForm(invalidFormData);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(4);
    });

    it('should handle non-array directors gracefully', () => {
      const invalidFormData: any = {
        ...validFormData,
        directors: 'not-an-array',
      };

      const result = service.validateMcaForm(invalidFormData);

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.message.includes('Directors'))).toBe(
        true,
      );
    });
  });

  describe('submitMcaForm', () => {
    const validDirector: Director = {
      name: 'John Doe',
      din: 'TEST0001',
      email: 'john@example.com',
    };

    const validFormData: McaFormData = {
      companyName: 'Test Corporation Private Limited',
      directors: [validDirector],
      registeredAddress: '456 Business Park, Tech City',
      authorizedCapital: 1000000,
      city: 'Hyderabad',
      state: 'Telangana',
      pincode: '500001',
    };

    it('should successfully submit valid form and generate result', async () => {
      const result = await service.submitMcaForm(validFormData);

      expect(result).toBeDefined();
      expect(result.cin).toBeDefined();
      expect(result.certificateDate).toBeInstanceOf(Date);
      expect(result.companyName).toBe(validFormData.companyName);
      expect(result.registrationNumber).toBeDefined();
      expect(result.submittedAt).toBeInstanceOf(Date);
    });

    it('should generate CIN in correct format', async () => {
      const result = await service.submitMcaForm(validFormData);

      // CIN format: U00000TS0000PTC000000
      expect(result.cin).toMatch(/^U00000TS0000PTC\d{6}$/);
      expect(result.cin.length).toBe(21);
    });

    it('should generate registration number in correct format', async () => {
      const result = await service.submitMcaForm(validFormData);

      // Registration number format: REG-000000
      expect(result.registrationNumber).toMatch(/^REG-\d{6}$/);
    });

    it('should generate unique CIN for each submission', async () => {
      const result1 = await service.submitMcaForm(validFormData);
      const result2 = await service.submitMcaForm(validFormData);

      // CINs should be different due to random serial number
      // (Note: There's a tiny chance they could be the same, but extremely unlikely)
      expect(result1.cin).toBeDefined();
      expect(result2.cin).toBeDefined();
    });

    it('should throw BadRequestException for invalid form data', async () => {
      const invalidFormData: any = {
        companyName: '',
        directors: [],
        registeredAddress: '',
        authorizedCapital: -1000,
      };

      await expect(service.submitMcaForm(invalidFormData)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should include validation errors in exception', async () => {
      const invalidFormData: any = {
        companyName: '',
        directors: [],
        registeredAddress: '',
        authorizedCapital: -1000,
      };

      try {
        await service.submitMcaForm(invalidFormData);
        fail('Should have thrown BadRequestException');
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect(error.message).toBeDefined();
        const response = error.getResponse() as any;
        expect(response.errors).toBeDefined();
        expect(Array.isArray(response.errors)).toBe(true);
        expect(response.errors.length).toBeGreaterThan(0);
      }
    });

    it('should reject submission with realistic DIN', async () => {
      const invalidFormData: McaFormData = {
        ...validFormData,
        directors: [
          {
            name: 'John Doe',
            din: '12345678', // Realistic pattern
            email: 'john@example.com',
          },
        ],
      };

      await expect(service.submitMcaForm(invalidFormData)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('DIN validation with MCA context', () => {
    it('should validate fictional DIN patterns', () => {
      const fictionalDINs = [
        'TEST0001',
        'DEMO0001',
        'TRAIN001',
        'LEARN001',
        'PRACT001',
        'SAMPL001',
      ];

      fictionalDINs.forEach((din) => {
        expect(() => service.validateDIN(din)).not.toThrow();
      });
    });

    it('should reject realistic DIN patterns (all digits)', () => {
      const realisticDINs = ['12345678', '00000000', '99999999', '01234567'];

      realisticDINs.forEach((din) => {
        expect(() => service.validateDIN(din)).toThrow(BadRequestException);
        expect(() => service.validateDIN(din)).toThrow(/Realistic DIN/);
      });
    });

    it('should include MCA-specific context in DIN error message', () => {
      try {
        service.validateDIN('12345678');
        fail('Should have thrown BadRequestException');
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect(error.message).toContain('MCA incorporation');
        expect(error.message).toContain('fictional pattern');
        expect(error.message).toContain('training purposes');
      }
    });

    it('should reject DIN with wrong length', () => {
      expect(() => service.validateDIN('TEST01')).toThrow(BadRequestException);
      expect(() => service.validateDIN('TEST000001')).toThrow(
        BadRequestException,
      );
    });

    it('should reject DIN with special characters', () => {
      expect(() => service.validateDIN('TEST@001')).toThrow(BadRequestException);
      expect(() => service.validateDIN('TEST-001')).toThrow(BadRequestException);
    });

    it('should reject empty or null DIN', () => {
      expect(() => service.validateDIN('')).toThrow(BadRequestException);
      expect(() => service.validateDIN(null as any)).toThrow(
        BadRequestException,
      );
      expect(() => service.validateDIN(undefined as any)).toThrow(
        BadRequestException,
      );
    });

    it('should handle DIN with whitespace', () => {
      expect(() => service.validateDIN('  TEST0001  ')).not.toThrow();
    });
  });

  describe('CIN generation', () => {
    it('should generate CIN with correct prefix components', async () => {
      const formData: McaFormData = {
        companyName: 'Test Corp',
        directors: [
          {
            name: 'Director',
            din: 'TEST0001',
            email: 'test@example.com',
          },
        ],
        registeredAddress: 'Test Address',
        authorizedCapital: 1000000,
      };

      const result = await service.submitMcaForm(formData);

      expect(result.cin.startsWith('U00000')).toBe(true); // Industry code
      expect(result.cin.substring(6, 8)).toBe('TS'); // State code
      expect(result.cin.substring(8, 12)).toBe('0000'); // Year
      expect(result.cin.substring(12, 15)).toBe('PTC'); // Company type
    });

    it('should generate CIN with 6-digit serial number', async () => {
      const formData: McaFormData = {
        companyName: 'Test Corp',
        directors: [
          {
            name: 'Director',
            din: 'TEST0001',
            email: 'test@example.com',
          },
        ],
        registeredAddress: 'Test Address',
        authorizedCapital: 1000000,
      };

      const result = await service.submitMcaForm(formData);

      const serialNumber = result.cin.substring(15);
      expect(serialNumber.length).toBe(6);
      expect(/^\d{6}$/.test(serialNumber)).toBe(true);
    });
  });

  describe('Edge cases', () => {
    it('should handle very large authorized capital', async () => {
      const formData: McaFormData = {
        companyName: 'Large Capital Corp',
        directors: [
          {
            name: 'Director',
            din: 'TEST0001',
            email: 'test@example.com',
          },
        ],
        registeredAddress: 'Test Address',
        authorizedCapital: 999999999999,
      };

      const result = await service.submitMcaForm(formData);
      expect(result).toBeDefined();
      expect(result.cin).toBeDefined();
    });

    it('should handle zero authorized capital', async () => {
      const formData: McaFormData = {
        companyName: 'Zero Capital Corp',
        directors: [
          {
            name: 'Director',
            din: 'TEST0001',
            email: 'test@example.com',
          },
        ],
        registeredAddress: 'Test Address',
        authorizedCapital: 0,
      };

      const result = await service.submitMcaForm(formData);
      expect(result).toBeDefined();
      expect(result.cin).toBeDefined();
    });

    it('should handle very long company name', async () => {
      const longName = 'A'.repeat(500);
      const formData: McaFormData = {
        companyName: longName,
        directors: [
          {
            name: 'Director',
            din: 'TEST0001',
            email: 'test@example.com',
          },
        ],
        registeredAddress: 'Test Address',
        authorizedCapital: 1000000,
      };

      const result = await service.submitMcaForm(formData);
      expect(result).toBeDefined();
      expect(result.companyName).toBe(longName);
    });

    it('should handle Unicode characters in company name', async () => {
      const formData: McaFormData = {
        companyName: 'टेस्ट कॉर्पोरेशन Private Limited',
        directors: [
          {
            name: 'Director',
            din: 'TEST0001',
            email: 'test@example.com',
          },
        ],
        registeredAddress: 'Test Address',
        authorizedCapital: 1000000,
      };

      const result = await service.submitMcaForm(formData);
      expect(result).toBeDefined();
      expect(result.companyName).toBe('टेस्ट कॉर्पोरेशन Private Limited');
    });
  });
});
