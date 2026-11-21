import { BadRequestException, Injectable } from '@nestjs/common';

/**
 * Lab Validation Service
 * 
 * Base validation service for government portal simulations.
 * Ensures fictional patterns are accepted while realistic patterns are rejected
 * to prevent accidental use of real identity documents.
 * 
 * Requirements: R28, R29, R30
 * Task 49: Implement shared lab validation framework
 */

export interface ValidationError {
  field: string;
  message: string;
}

@Injectable()
export class LabValidationService {
  /**
   * Validate PAN (Permanent Account Number) format
   * 
   * Rejects realistic patterns: AAAAA0000A (5 letters, 4 digits, 1 letter)
   * Accepts fictional patterns: TEST00000T, DEMO00000D, TRAIN0000R, LEARN0000L
   * 
   * @param pan - The PAN string to validate
   * @returns true if fictional pattern, throws BadRequestException if realistic or invalid
   */
  validatePAN(pan: string): boolean {
    if (!pan || typeof pan !== 'string') {
      throw new BadRequestException('PAN is required and must be a string');
    }

    // Remove whitespace and convert to uppercase for validation
    const cleanPan = pan.trim().toUpperCase();

    // PAN must be exactly 10 characters
    if (cleanPan.length !== 10) {
      throw new BadRequestException(
        'Invalid PAN format: Must be exactly 10 characters',
      );
    }

    // Define realistic PAN pattern: 5 letters, 4 digits, 1 letter
    // Example: ABCDE1234F
    const realisticPattern = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;

    if (realisticPattern.test(cleanPan)) {
      // Check if it uses fictional prefixes
      const fictionalPrefixes = ['TEST0', 'DEMO0', 'TRAIN', 'LEARN', 'PRACT', 'SAMPL'];
      const hasFictionalPrefix = fictionalPrefixes.some((prefix) =>
        cleanPan.startsWith(prefix),
      );

      if (!hasFictionalPrefix) {
        throw new BadRequestException(
          'Realistic PAN patterns are not allowed. This is a training simulation. ' +
            'Please use fictional patterns like TEST00000T, DEMO00000D, TRAIN0000R, or LEARN0000L',
        );
      }
    }

    // Accept fictional patterns that don't match realistic format
    // Examples: TEST00000T, DEMO00000D, XXX000000X
    const fictionalPattern = /^[A-Z0-9]{10}$/;

    if (!fictionalPattern.test(cleanPan)) {
      throw new BadRequestException(
        'Invalid PAN format: Must contain only letters and numbers',
      );
    }

    return true;
  }

  /**
   * Validate DIN (Director Identification Number) format
   * 
   * Rejects realistic patterns: 00000000 (8 digits)
   * Accepts fictional patterns: TEST0001, DEMO0001, TRAIN001, LEARN001
   * 
   * @param din - The DIN string to validate
   * @returns true if fictional pattern, throws BadRequestException if realistic or invalid
   */
  validateDIN(din: string): boolean {
    if (!din || typeof din !== 'string') {
      throw new BadRequestException('DIN is required and must be a string');
    }

    // Remove whitespace and convert to uppercase for validation
    const cleanDin = din.trim().toUpperCase();

    // DIN must be 8 characters
    if (cleanDin.length !== 8) {
      throw new BadRequestException(
        'Invalid DIN format: Must be exactly 8 characters',
      );
    }

    // Define realistic DIN pattern: 8 digits
    // Example: 01234567
    const realisticPattern = /^[0-9]{8}$/;

    if (realisticPattern.test(cleanDin)) {
      throw new BadRequestException(
        'Realistic DIN patterns are not allowed. This is a training simulation. ' +
          'Please use fictional patterns like TEST0001, DEMO0001, TRAIN001, or LEARN001',
      );
    }

    // Accept fictional patterns that contain letters
    // Examples: TEST0001, DEMO0001, ABCD1234
    const fictionalPattern = /^[A-Z0-9]{8}$/;

    if (!fictionalPattern.test(cleanDin)) {
      throw new BadRequestException(
        'Invalid DIN format: Must contain only letters and numbers',
      );
    }

    // Ensure it has at least one letter (not all digits)
    const hasLetter = /[A-Z]/.test(cleanDin);
    if (!hasLetter) {
      throw new BadRequestException(
        'DIN must contain at least one letter to be a fictional pattern',
      );
    }

    return true;
  }

  /**
   * Validate that a required string field is present and not empty
   * 
   * @param value - The field value to validate
   * @param fieldName - The name of the field for error messages
   * @returns true if valid, throws BadRequestException if invalid
   */
  validateRequiredString(value: any, fieldName: string): boolean {
    if (value === undefined || value === null) {
      throw new BadRequestException(`${fieldName} is required`);
    }

    if (typeof value !== 'string') {
      throw new BadRequestException(`${fieldName} must be a string`);
    }

    const trimmedValue = value.trim();
    if (trimmedValue.length === 0) {
      throw new BadRequestException(`${fieldName} cannot be empty`);
    }

    return true;
  }

  /**
   * Validate that a required number field is present and valid
   * 
   * @param value - The field value to validate
   * @param fieldName - The name of the field for error messages
   * @param options - Optional validation options (min, max)
   * @returns true if valid, throws BadRequestException if invalid
   */
  validateRequiredNumber(
    value: any,
    fieldName: string,
    options?: { min?: number; max?: number },
  ): boolean {
    if (value === undefined || value === null) {
      throw new BadRequestException(`${fieldName} is required`);
    }

    const numValue = Number(value);
    if (isNaN(numValue)) {
      throw new BadRequestException(`${fieldName} must be a valid number`);
    }

    if (options?.min !== undefined && numValue < options.min) {
      throw new BadRequestException(
        `${fieldName} must be at least ${options.min}`,
      );
    }

    if (options?.max !== undefined && numValue > options.max) {
      throw new BadRequestException(
        `${fieldName} must be at most ${options.max}`,
      );
    }

    return true;
  }

  /**
   * Validate that an email field has a valid format
   * 
   * @param email - The email string to validate
   * @param fieldName - The name of the field for error messages
   * @returns true if valid, throws BadRequestException if invalid
   */
  validateEmail(email: string, fieldName: string = 'Email'): boolean {
    this.validateRequiredString(email, fieldName);

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email)) {
      throw new BadRequestException(`${fieldName} must be a valid email address`);
    }

    return true;
  }

  /**
   * Validate that a phone number field has a valid format
   * 
   * @param phone - The phone number string to validate
   * @param fieldName - The name of the field for error messages
   * @returns true if valid, throws BadRequestException if invalid
   */
  validatePhone(phone: string, fieldName: string = 'Phone number'): boolean {
    this.validateRequiredString(phone, fieldName);

    // Accept 10-digit Indian phone numbers or formats with country code
    const phonePattern = /^(\+91)?[6-9]\d{9}$/;
    const cleanPhone = phone.replace(/[\s\-()]/g, '');

    if (!phonePattern.test(cleanPhone)) {
      throw new BadRequestException(
        `${fieldName} must be a valid 10-digit Indian mobile number`,
      );
    }

    return true;
  }

  /**
   * Validate that an array field is present and has minimum length
   * 
   * @param arr - The array to validate
   * @param fieldName - The name of the field for error messages
   * @param minLength - Minimum required length (default: 1)
   * @returns true if valid, throws BadRequestException if invalid
   */
  validateRequiredArray(
    arr: any,
    fieldName: string,
    minLength: number = 1,
  ): boolean {
    if (!Array.isArray(arr)) {
      throw new BadRequestException(`${fieldName} must be an array`);
    }

    if (arr.length < minLength) {
      throw new BadRequestException(
        `${fieldName} must contain at least ${minLength} item(s)`,
      );
    }

    return true;
  }

  /**
   * Collect multiple validation errors without throwing immediately
   * Useful for validating entire forms and returning all errors at once
   * 
   * @param validations - Array of validation functions to execute
   * @returns Array of validation errors (empty if all validations pass)
   */
  collectValidationErrors(
    validations: Array<() => void>,
  ): ValidationError[] {
    const errors: ValidationError[] = [];

    for (const validation of validations) {
      try {
        validation();
      } catch (error) {
        if (error instanceof BadRequestException) {
          // Extract field name from error message if possible
          const message = error.message;
          const field = this.extractFieldName(message);

          errors.push({
            field,
            message,
          });
        }
      }
    }

    return errors;
  }

  /**
   * Derive the field name from a validation message, e.g.
   * "Business Name is required" -> "Business Name", "Invalid PAN format: ..." -> "PAN".
   */
  private extractFieldName(message: string): string {
    const generic = message.match(/^(.+?)\s+(?:is required|must|cannot|should)\b/);
    if (generic && !/^(Invalid|Realistic)\b/.test(generic[1])) {
      return generic[1].trim();
    }
    if (/\bPAN\b/.test(message)) return 'PAN';
    if (/\bDIN\b/.test(message)) return 'DIN';
    return 'Unknown';
  }
}
