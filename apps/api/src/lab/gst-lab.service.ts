import { Injectable, BadRequestException } from '@nestjs/common';
import { LabValidationService } from './lab-validation.service';

/**
 * GST Registration Lab Service
 * 
 * Provides GST Registration government portal simulation.
 * Validates form submissions and generates fictional GSTIN and ARN numbers.
 * 
 * Requirements: R28 (GST Registration Simulation)
 * Task 50: Build GST Registration simulation
 */

export interface GstFormData {
  businessName: string;
  businessType: string;
  pan: string;
  address: string;
  signatory: string;
}

export interface GstResult {
  gstin: string;
  arn: string;
  applicationDate: string;
  status: string;
}

export interface GstLabAttempt {
  formData: GstFormData;
  result: GstResult;
}

@Injectable()
export class GstLabService extends LabValidationService {
  private lastArnSequence = 0;

  /**
   * Validate GST Registration form data
   * 
   * Validates all required fields are present and PAN matches fictional pattern.
   * 
   * @param formData - The GST form data to validate
   * @throws BadRequestException if validation fails
   */
  validateGstForm(formData: GstFormData): void {
    const errors = this.collectValidationErrors([
      () => this.validateRequiredString(formData.businessName, 'Business Name'),
      () => this.validateRequiredString(formData.businessType, 'Business Type'),
      () => this.validateRequiredString(formData.pan, 'PAN'),
      () => this.validateRequiredString(formData.address, 'Address'),
      () => this.validateRequiredString(formData.signatory, 'Authorized Signatory'),
    ]);

    if (errors.length > 0) {
      const errorMessages = errors.map((e) => e.message).join('; ');
      throw new BadRequestException(errorMessages);
    }

    // Validate PAN format (this will throw if realistic pattern)
    this.validatePAN(formData.pan);
  }

  /**
   * Generate simulated GSTIN (Goods and Services Tax Identification Number)
   * 
   * Format: 00TESTX0000X0Z0
   * - First 2 digits: State code (00 for simulation)
   * - Next 10 characters: PAN of the business
   * - 13th character: Entity code (default 'Z' for simulation)
   * - 14th character: Default 'Z' for simulation
   * - 15th character: Check digit (default '0' for simulation)
   * 
   * @param pan - The PAN to include in GSTIN
   * @returns Simulated GSTIN string
   */
  generateGstin(pan: string): string {
    const cleanPan = pan.trim().toUpperCase();
    
    // Format: 00 + PAN (10 chars) + Z + Z + 0
    const stateCode = '00';
    const entityCode = 'Z';
    const defaultChar = '0';
    const checkDigit = '0';
    
    return `${stateCode}${cleanPan}${entityCode}${defaultChar}${checkDigit}`;
  }

  /**
   * Generate simulated ARN (Application Reference Number)
   * 
   * Format: AR0000000000000 (15 characters)
   * - First 2 characters: 'AR' prefix
   * - Next 13 characters: Sequential number (zero-padded)
   * 
   * Uses timestamp-based generation to ensure uniqueness
   * 
   * @returns Simulated ARN string
   */
  generateArn(): string {
    // Timestamp-based, but strictly increasing so rapid submissions stay unique
    this.lastArnSequence = Math.max(Date.now(), this.lastArnSequence + 1);
    // Take last 13 digits and pad if necessary
    const sequentialNumber = this.lastArnSequence.toString().slice(-13).padStart(13, '0');
    
    return `AR${sequentialNumber}`;
  }

  /**
   * Process GST Registration form submission
   * 
   * Validates the form data and generates simulated GSTIN and ARN.
   * Returns the attempt data ready for storage.
   * 
   * @param formData - The GST form data to process
   * @returns Lab attempt with form data and simulated result
   * @throws BadRequestException if validation fails
   */
  processGstSubmission(formData: GstFormData): GstLabAttempt {
    // Validate form data
    this.validateGstForm(formData);

    // Generate simulated results
    const gstin = this.generateGstin(formData.pan);
    const arn = this.generateArn();
    const applicationDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format

    const result: GstResult = {
      gstin,
      arn,
      applicationDate,
      status: 'Approved (Simulated)',
    };

    return {
      formData,
      result,
    };
  }
}
