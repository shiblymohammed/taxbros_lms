import { Injectable, BadRequestException } from '@nestjs/common';
import { LabValidationService, ValidationError } from './lab-validation.service';

/**
 * MCA Lab Service
 * 
 * Handles the MCA (Ministry of Corporate Affairs) company incorporation simulation.
 * Validates form submissions with fictional data patterns and generates simulated CIN.
 * 
 * Requirements: R30
 * Task 52: Build MCA Incorporation simulation
 */

export interface Director {
  name: string;
  din: string;
  email: string;
  address?: string;
}

export interface McaFormData {
  companyName: string;
  directors: Director[];
  registeredAddress: string;
  authorizedCapital: number;
  city?: string;
  state?: string;
  pincode?: string;
}

export interface McaValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

export interface McaSubmissionResult {
  cin: string;
  certificateDate: Date;
  companyName: string;
  registrationNumber: string;
  submittedAt: Date;
}

@Injectable()
export class McaLabService extends LabValidationService {
  /**
   * Validate MCA incorporation form data
   * 
   * Validates:
   * - Company name (required string)
   * - Directors array (at least 1 director required)
   * - Each director's name, DIN (fictional pattern), and email
   * - Registered address (required string)
   * - Authorized capital (required number, min 0)
   * 
   * @param formData - The MCA form data to validate
   * @returns Validation result with isValid flag and error array
   */
  validateMcaForm(formData: McaFormData): McaValidationResult {
    // Collect all validation errors without throwing immediately
    const errors = this.collectValidationErrors([
      // Validate company name
      () => this.validateRequiredString(formData.companyName, 'Company Name'),

      // Validate directors array exists and has at least one director
      () => this.validateRequiredArray(formData.directors, 'Directors', 1),

      // Validate registered address
      () =>
        this.validateRequiredString(
          formData.registeredAddress,
          'Registered Address',
        ),

      // Validate authorized capital
      () =>
        this.validateRequiredNumber(
          formData.authorizedCapital,
          'Authorized Capital',
          { min: 0 },
        ),

      // Validate each director's fields
      ...(Array.isArray(formData.directors)
        ? formData.directors.flatMap((director, index) => [
            () =>
              this.validateRequiredString(
                director.name,
                `Director ${index + 1} Name`,
              ),
            () => this.validateDIN(director.din),
            () =>
              this.validateEmail(director.email, `Director ${index + 1} Email`),
          ])
        : []),

      // Optional field validations (if provided)
      ...(formData.city
        ? [() => this.validateRequiredString(formData.city, 'City')]
        : []),
      ...(formData.state
        ? [() => this.validateRequiredString(formData.state, 'State')]
        : []),
      ...(formData.pincode
        ? [() => this.validateRequiredString(formData.pincode, 'Pincode')]
        : []),
    ]);

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Process MCA incorporation form submission
   * 
   * Validates the form data and generates a simulated certificate of incorporation
   * with a fictional CIN (Corporate Identification Number).
   * 
   * @param formData - The validated MCA form data
   * @returns Submission result with generated CIN and certificate details
   * @throws BadRequestException if validation fails
   */
  async submitMcaForm(formData: McaFormData): Promise<McaSubmissionResult> {
    // Validate form data
    const validation = this.validateMcaForm(formData);

    if (!validation.isValid) {
      throw new BadRequestException({
        message: 'Form validation failed',
        errors: validation.errors,
      });
    }

    // Generate simulated CIN and registration details
    const result: McaSubmissionResult = {
      cin: this.generateSimulatedCIN(),
      certificateDate: new Date(),
      companyName: formData.companyName,
      registrationNumber: this.generateRegistrationNumber(),
      submittedAt: new Date(),
    };

    return result;
  }

  /**
   * Generate a simulated Corporate Identification Number (CIN)
   * 
   * Format: U00000TS0000PTC000000
   * - U00000: Industry code (fictional)
   * - TS: State code (Telangana - fictional)
   * - 0000: Year of registration (fictional)
   * - PTC: Company type (Private Company)
   * - 000000: Serial number (random 6 digits)
   * 
   * @returns Simulated CIN string
   */
  private generateSimulatedCIN(): string {
    const prefix = 'U00000'; // Fictional industry code
    const stateCode = 'TS'; // Telangana state code
    const year = '0000'; // Fictional year
    const companyType = 'PTC'; // Private Company
    const serialNumber = Math.floor(Math.random() * 1e6)
      .toString()
      .padStart(6, '0');

    return `${prefix}${stateCode}${year}${companyType}${serialNumber}`;
  }

  /**
   * Generate a simulated registration number
   * 
   * Format: REG-000000 (6 random digits)
   * 
   * @returns Simulated registration number string
   */
  private generateRegistrationNumber(): string {
    const number = Math.floor(Math.random() * 1e6)
      .toString()
      .padStart(6, '0');
    return `REG-${number}`;
  }

  /**
   * Validate DIN with additional context message
   * 
   * Overrides base class method to provide MCA-specific error context
   * 
   * @param din - The DIN string to validate
   * @returns true if fictional pattern, throws BadRequestException if realistic or invalid
   */
  validateDIN(din: string): boolean {
    try {
      return super.validateDIN(din);
    } catch (error) {
      if (error instanceof BadRequestException) {
        // Re-throw with additional context for MCA simulation
        throw new BadRequestException(
          `${error.message}. In MCA incorporation, DIN must be a fictional pattern for training purposes.`,
        );
      }
      throw error;
    }
  }
}
