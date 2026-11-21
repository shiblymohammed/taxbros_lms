import { BadRequestException } from '@nestjs/common';
import { LabValidationService } from './lab-validation.service';

/**
 * Lab Validation Service Tests
 * 
 * Tests the shared validation framework for government portal simulations.
 * Verifies that fictional patterns are accepted and realistic patterns are rejected.
 * 
 * Requirements: R28, R29, R30
 * Task 49: Implement shared lab validation framework
 * Test Coverage: T6 (Validation rules)
 */

describe('LabValidationService', () => {
  let service: LabValidationService;

  beforeEach(() => {
    service = new LabValidationService();
  });

  describe('validatePAN', () => {
    describe('fictional patterns (should accept)', () => {
      it('should accept TEST00000T pattern', () => {
        expect(service.validatePAN('TEST00000T')).toBe(true);
      });

      it('should accept DEMO00000D pattern', () => {
        expect(service.validatePAN('DEMO00000D')).toBe(true);
      });

      it('should accept TRAIN0000R pattern', () => {
        expect(service.validatePAN('TRAIN0000R')).toBe(true);
      });

      it('should accept LEARN0000L pattern', () => {
        expect(service.validatePAN('LEARN0000L')).toBe(true);
      });

      it('should accept PRACT0000P pattern', () => {
        expect(service.validatePAN('PRACT0000P')).toBe(true);
      });

      it('should accept SAMPL0000S pattern', () => {
        expect(service.validatePAN('SAMPL0000S')).toBe(true);
      });

      it('should accept lowercase and convert to uppercase', () => {
        expect(service.validatePAN('test00000t')).toBe(true);
      });

      it('should accept PAN with whitespace and trim it', () => {
        expect(service.validatePAN('  TEST00000T  ')).toBe(true);
      });

      it('should accept non-standard fictional patterns', () => {
        // Patterns that don't match realistic format
        expect(service.validatePAN('XXX0000000')).toBe(true);
        expect(service.validatePAN('ABC00XYZ12')).toBe(true);
        expect(service.validatePAN('1234567890')).toBe(true);
      });
    });

    describe('realistic patterns (should reject)', () => {
      it('should reject AAAAA0000A pattern (5 letters, 4 digits, 1 letter)', () => {
        expect(() => service.validatePAN('ABCDE1234F')).toThrow(
          BadRequestException,
        );
        expect(() => service.validatePAN('ABCDE1234F')).toThrow(
          /Realistic PAN patterns are not allowed/,
        );
      });

      it('should reject BBBBB1111B pattern', () => {
        expect(() => service.validatePAN('BBBBB1111B')).toThrow(
          BadRequestException,
        );
      });

      it('should reject CCCCC2222C pattern', () => {
        expect(() => service.validatePAN('CCCCC2222C')).toThrow(
          BadRequestException,
        );
      });

      it('should reject ZYXWV9876Z pattern', () => {
        expect(() => service.validatePAN('ZYXWV9876Z')).toThrow(
          BadRequestException,
        );
      });

      it('should reject realistic pattern even with lowercase', () => {
        expect(() => service.validatePAN('abcde1234f')).toThrow(
          BadRequestException,
        );
      });

      it('should provide helpful error message for realistic patterns', () => {
        expect(() => service.validatePAN('ABCDE1234F')).toThrow(
          /Please use fictional patterns like TEST00000T/,
        );
      });
    });

    describe('invalid formats (should reject)', () => {
      it('should reject null PAN', () => {
        expect(() => service.validatePAN(null as any)).toThrow(
          BadRequestException,
        );
        expect(() => service.validatePAN(null as any)).toThrow(
          /PAN is required/,
        );
      });

      it('should reject undefined PAN', () => {
        expect(() => service.validatePAN(undefined as any)).toThrow(
          BadRequestException,
        );
      });

      it('should reject empty string', () => {
        expect(() => service.validatePAN('')).toThrow(BadRequestException);
      });

      it('should reject PAN shorter than 10 characters', () => {
        expect(() => service.validatePAN('TEST0000')).toThrow(
          BadRequestException,
        );
        expect(() => service.validatePAN('TEST0000')).toThrow(
          /Must be exactly 10 characters/,
        );
      });

      it('should reject PAN longer than 10 characters', () => {
        expect(() => service.validatePAN('TEST000000T')).toThrow(
          BadRequestException,
        );
      });

      it('should reject PAN with special characters', () => {
        expect(() => service.validatePAN('TEST@0000T')).toThrow(
          BadRequestException,
        );
        expect(() => service.validatePAN('TEST@0000T')).toThrow(
          /Must contain only letters and numbers/,
        );
      });

      it('should reject non-string values', () => {
        expect(() => service.validatePAN(123 as any)).toThrow(
          BadRequestException,
        );
      });
    });
  });

  describe('validateDIN', () => {
    describe('fictional patterns (should accept)', () => {
      it('should accept TEST0001 pattern', () => {
        expect(service.validateDIN('TEST0001')).toBe(true);
      });

      it('should accept DEMO0001 pattern', () => {
        expect(service.validateDIN('DEMO0001')).toBe(true);
      });

      it('should accept TRAIN001 pattern', () => {
        expect(service.validateDIN('TRAIN001')).toBe(true);
      });

      it('should accept LEARN001 pattern', () => {
        expect(service.validateDIN('LEARN001')).toBe(true);
      });

      it('should accept mixed alphanumeric patterns', () => {
        expect(service.validateDIN('ABCD1234')).toBe(true);
        expect(service.validateDIN('X1Y2Z3A4')).toBe(true);
      });

      it('should accept lowercase and convert to uppercase', () => {
        expect(service.validateDIN('test0001')).toBe(true);
      });

      it('should accept DIN with whitespace and trim it', () => {
        expect(service.validateDIN('  TEST0001  ')).toBe(true);
      });
    });

    describe('realistic patterns (should reject)', () => {
      it('should reject 8-digit pattern 01234567', () => {
        expect(() => service.validateDIN('01234567')).toThrow(
          BadRequestException,
        );
        expect(() => service.validateDIN('01234567')).toThrow(
          /Realistic DIN patterns are not allowed/,
        );
      });

      it('should reject 8-digit pattern 12345678', () => {
        expect(() => service.validateDIN('12345678')).toThrow(
          BadRequestException,
        );
      });

      it('should reject 8-digit pattern 00000001', () => {
        expect(() => service.validateDIN('00000001')).toThrow(
          BadRequestException,
        );
      });

      it('should reject 8-digit pattern 99999999', () => {
        expect(() => service.validateDIN('99999999')).toThrow(
          BadRequestException,
        );
      });

      it('should provide helpful error message for realistic patterns', () => {
        expect(() => service.validateDIN('12345678')).toThrow(
          /Please use fictional patterns like TEST0001/,
        );
      });
    });

    describe('invalid formats (should reject)', () => {
      it('should reject null DIN', () => {
        expect(() => service.validateDIN(null as any)).toThrow(
          BadRequestException,
        );
        expect(() => service.validateDIN(null as any)).toThrow(
          /DIN is required/,
        );
      });

      it('should reject undefined DIN', () => {
        expect(() => service.validateDIN(undefined as any)).toThrow(
          BadRequestException,
        );
      });

      it('should reject empty string', () => {
        expect(() => service.validateDIN('')).toThrow(BadRequestException);
      });

      it('should reject DIN shorter than 8 characters', () => {
        expect(() => service.validateDIN('TEST001')).toThrow(
          BadRequestException,
        );
        expect(() => service.validateDIN('TEST001')).toThrow(
          /Must be exactly 8 characters/,
        );
      });

      it('should reject DIN longer than 8 characters', () => {
        expect(() => service.validateDIN('TEST00001')).toThrow(
          BadRequestException,
        );
      });

      it('should reject DIN with special characters', () => {
        expect(() => service.validateDIN('TEST@001')).toThrow(
          BadRequestException,
        );
        expect(() => service.validateDIN('TEST@001')).toThrow(
          /Must contain only letters and numbers/,
        );
      });

      it('should reject non-string values', () => {
        expect(() => service.validateDIN(123 as any)).toThrow(
          BadRequestException,
        );
      });
    });
  });

  describe('validateRequiredString', () => {
    it('should accept valid non-empty string', () => {
      expect(service.validateRequiredString('Test Value', 'TestField')).toBe(
        true,
      );
    });

    it('should reject null value', () => {
      expect(() =>
        service.validateRequiredString(null, 'TestField'),
      ).toThrow(BadRequestException);
      expect(() =>
        service.validateRequiredString(null, 'TestField'),
      ).toThrow(/TestField is required/);
    });

    it('should reject undefined value', () => {
      expect(() =>
        service.validateRequiredString(undefined, 'TestField'),
      ).toThrow(BadRequestException);
    });

    it('should reject non-string value', () => {
      expect(() =>
        service.validateRequiredString(123 as any, 'TestField'),
      ).toThrow(BadRequestException);
      expect(() =>
        service.validateRequiredString(123 as any, 'TestField'),
      ).toThrow(/must be a string/);
    });

    it('should reject empty string', () => {
      expect(() => service.validateRequiredString('', 'TestField')).toThrow(
        BadRequestException,
      );
      expect(() => service.validateRequiredString('', 'TestField')).toThrow(
        /cannot be empty/,
      );
    });

    it('should reject whitespace-only string', () => {
      expect(() =>
        service.validateRequiredString('   ', 'TestField'),
      ).toThrow(BadRequestException);
    });
  });

  describe('validateRequiredNumber', () => {
    it('should accept valid number', () => {
      expect(service.validateRequiredNumber(42, 'TestField')).toBe(true);
    });

    it('should accept zero', () => {
      expect(service.validateRequiredNumber(0, 'TestField')).toBe(true);
    });

    it('should accept negative numbers', () => {
      expect(service.validateRequiredNumber(-10, 'TestField')).toBe(true);
    });

    it('should accept string numbers', () => {
      expect(service.validateRequiredNumber('42', 'TestField')).toBe(true);
    });

    it('should reject null value', () => {
      expect(() => service.validateRequiredNumber(null, 'TestField')).toThrow(
        BadRequestException,
      );
      expect(() => service.validateRequiredNumber(null, 'TestField')).toThrow(
        /TestField is required/,
      );
    });

    it('should reject undefined value', () => {
      expect(() =>
        service.validateRequiredNumber(undefined, 'TestField'),
      ).toThrow(BadRequestException);
    });

    it('should reject non-numeric string', () => {
      expect(() =>
        service.validateRequiredNumber('abc', 'TestField'),
      ).toThrow(BadRequestException);
      expect(() =>
        service.validateRequiredNumber('abc', 'TestField'),
      ).toThrow(/must be a valid number/);
    });

    it('should enforce minimum value', () => {
      expect(() =>
        service.validateRequiredNumber(5, 'TestField', { min: 10 }),
      ).toThrow(BadRequestException);
      expect(() =>
        service.validateRequiredNumber(5, 'TestField', { min: 10 }),
      ).toThrow(/must be at least 10/);
    });

    it('should enforce maximum value', () => {
      expect(() =>
        service.validateRequiredNumber(100, 'TestField', { max: 50 }),
      ).toThrow(BadRequestException);
      expect(() =>
        service.validateRequiredNumber(100, 'TestField', { max: 50 }),
      ).toThrow(/must be at most 50/);
    });

    it('should accept value within min/max range', () => {
      expect(
        service.validateRequiredNumber(25, 'TestField', { min: 10, max: 50 }),
      ).toBe(true);
    });
  });

  describe('validateEmail', () => {
    it('should accept valid email', () => {
      expect(service.validateEmail('test@example.com')).toBe(true);
    });

    it('should accept email with subdomain', () => {
      expect(service.validateEmail('user@mail.example.com')).toBe(true);
    });

    it('should reject email without @', () => {
      expect(() => service.validateEmail('testexample.com')).toThrow(
        BadRequestException,
      );
      expect(() => service.validateEmail('testexample.com')).toThrow(
        /must be a valid email/,
      );
    });

    it('should reject email without domain', () => {
      expect(() => service.validateEmail('test@')).toThrow(
        BadRequestException,
      );
    });

    it('should reject email without local part', () => {
      expect(() => service.validateEmail('@example.com')).toThrow(
        BadRequestException,
      );
    });

    it('should use custom field name in error message', () => {
      expect(() => service.validateEmail('invalid', 'Contact Email')).toThrow(
        /Contact Email must be a valid email/,
      );
    });
  });

  describe('validatePhone', () => {
    it('should accept valid 10-digit Indian mobile', () => {
      expect(service.validatePhone('9876543210')).toBe(true);
    });

    it('should accept phone with country code', () => {
      expect(service.validatePhone('+919876543210')).toBe(true);
    });

    it('should accept phone with spaces', () => {
      expect(service.validatePhone('98765 43210')).toBe(true);
    });

    it('should accept phone with dashes', () => {
      expect(service.validatePhone('9876-543-210')).toBe(true);
    });

    it('should accept phone with parentheses', () => {
      expect(service.validatePhone('(987) 654-3210')).toBe(true);
    });

    it('should reject phone starting with invalid digit', () => {
      expect(() => service.validatePhone('1876543210')).toThrow(
        BadRequestException,
      );
      expect(() => service.validatePhone('1876543210')).toThrow(
        /must be a valid 10-digit Indian mobile/,
      );
    });

    it('should reject phone shorter than 10 digits', () => {
      expect(() => service.validatePhone('987654321')).toThrow(
        BadRequestException,
      );
    });

    it('should reject phone longer than 10 digits', () => {
      expect(() => service.validatePhone('98765432100')).toThrow(
        BadRequestException,
      );
    });

    it('should use custom field name in error message', () => {
      expect(() => service.validatePhone('123', 'Mobile Number')).toThrow(
        /Mobile Number must be a valid/,
      );
    });
  });

  describe('validateRequiredArray', () => {
    it('should accept non-empty array', () => {
      expect(service.validateRequiredArray([1, 2, 3], 'TestArray')).toBe(
        true,
      );
    });

    it('should accept array with exactly minimum length', () => {
      expect(service.validateRequiredArray(['item'], 'TestArray', 1)).toBe(
        true,
      );
    });

    it('should reject null value', () => {
      expect(() =>
        service.validateRequiredArray(null as any, 'TestArray'),
      ).toThrow(BadRequestException);
      expect(() =>
        service.validateRequiredArray(null as any, 'TestArray'),
      ).toThrow(/must be an array/);
    });

    it('should reject non-array value', () => {
      expect(() =>
        service.validateRequiredArray('not an array' as any, 'TestArray'),
      ).toThrow(BadRequestException);
    });

    it('should reject empty array with default minLength', () => {
      expect(() => service.validateRequiredArray([], 'TestArray')).toThrow(
        BadRequestException,
      );
      expect(() => service.validateRequiredArray([], 'TestArray')).toThrow(
        /must contain at least 1 item/,
      );
    });

    it('should reject array shorter than minLength', () => {
      expect(() =>
        service.validateRequiredArray([1], 'TestArray', 3),
      ).toThrow(BadRequestException);
      expect(() =>
        service.validateRequiredArray([1], 'TestArray', 3),
      ).toThrow(/must contain at least 3 item/);
    });

    it('should accept empty array when minLength is 0', () => {
      expect(service.validateRequiredArray([], 'TestArray', 0)).toBe(true);
    });
  });

  describe('collectValidationErrors', () => {
    it('should return empty array when all validations pass', () => {
      const errors = service.collectValidationErrors([
        () => service.validateRequiredString('test', 'Field1'),
        () => service.validateRequiredNumber(42, 'Field2'),
      ]);

      expect(errors).toEqual([]);
    });

    it('should collect single validation error', () => {
      const errors = service.collectValidationErrors([
        () => service.validateRequiredString('', 'Field1'),
      ]);

      expect(errors).toHaveLength(1);
      expect(errors[0].field).toBe('Field1');
      expect(errors[0].message).toContain('cannot be empty');
    });

    it('should collect multiple validation errors', () => {
      const errors = service.collectValidationErrors([
        () => service.validateRequiredString('', 'BusinessName'),
        () => service.validatePAN('ABCDE1234F'),
        () => service.validateDIN('12345678'),
      ]);

      expect(errors).toHaveLength(3);
      expect(errors[0].field).toBe('BusinessName');
      expect(errors[1].message).toContain('Realistic PAN');
      expect(errors[2].message).toContain('Realistic DIN');
    });

    it('should continue validation even after errors', () => {
      const errors = service.collectValidationErrors([
        () => service.validateRequiredString(null as any, 'Field1'),
        () => service.validateRequiredString('valid', 'Field2'),
        () => service.validateRequiredNumber(null as any, 'Field3'),
      ]);

      expect(errors).toHaveLength(2);
      expect(errors.map((e) => e.field)).toEqual(['Field1', 'Field3']);
    });

    it('should handle validations that do not throw', () => {
      const errors = service.collectValidationErrors([
        () => service.validateRequiredString('valid', 'Field1'),
        () => service.validatePAN('TEST00000T'),
      ]);

      expect(errors).toEqual([]);
    });
  });
});
