# Lab Validation Framework

## Overview

The Lab Validation Framework provides a shared validation service for government portal simulations (GST Registration, Income Tax Return, and MCA Incorporation). The framework ensures that only fictional identity documents are accepted while realistic patterns are rejected to prevent accidental use of real data.

**Requirements:** R28, R29, R30  
**Task:** 49 - Implement shared lab validation framework

## Core Validation Methods

### PAN (Permanent Account Number) Validation

```typescript
validatePAN(pan: string): boolean
```

**Accepts fictional patterns:**
- `TEST00000T`
- `DEMO00000D`
- `TRAIN0000R`
- `LEARN0000L`
- `PRACT0000P`
- `SAMPL0000S`
- Any pattern that doesn't match the realistic format

**Rejects realistic patterns:**
- `AAAAA0000A` (5 letters, 4 digits, 1 letter)
- Any pattern matching real PAN format without fictional prefix

**Example:**
```typescript
service.validatePAN('TEST00000T'); // ✓ Returns true
service.validatePAN('ABCDE1234F'); // ✗ Throws BadRequestException
```

### DIN (Director Identification Number) Validation

```typescript
validateDIN(din: string): boolean
```

**Accepts fictional patterns:**
- `TEST0001`
- `DEMO0001`
- `TRAIN001`
- `LEARN001`
- Any 8-character pattern containing at least one letter

**Rejects realistic patterns:**
- `01234567` (8 digits)
- Any pattern with only digits

**Example:**
```typescript
service.validateDIN('TEST0001'); // ✓ Returns true
service.validateDIN('12345678'); // ✗ Throws BadRequestException
```

## Reusable Field Validators

### Required String Validation

```typescript
validateRequiredString(value: any, fieldName: string): boolean
```

Validates that a string field is present and not empty (after trimming).

**Example:**
```typescript
service.validateRequiredString('Business Name', 'Business Name'); // ✓
service.validateRequiredString('', 'Business Name'); // ✗ Throws error
```

### Required Number Validation

```typescript
validateRequiredNumber(value: any, fieldName: string, options?: { min?: number; max?: number }): boolean
```

Validates that a number field is present and optionally within a range.

**Example:**
```typescript
service.validateRequiredNumber(1000000, 'Authorized Capital', { min: 0 }); // ✓
service.validateRequiredNumber(-100, 'Income', { min: 0 }); // ✗ Throws error
```

### Email Validation

```typescript
validateEmail(email: string, fieldName?: string): boolean
```

Validates email format using standard email regex.

**Example:**
```typescript
service.validateEmail('user@example.com'); // ✓
service.validateEmail('invalid-email'); // ✗ Throws error
```

### Phone Validation

```typescript
validatePhone(phone: string, fieldName?: string): boolean
```

Validates 10-digit Indian mobile numbers with optional country code.

**Example:**
```typescript
service.validatePhone('9876543210'); // ✓
service.validatePhone('+919876543210'); // ✓
service.validatePhone('1234567890'); // ✗ Throws error (invalid starting digit)
```

### Array Validation

```typescript
validateRequiredArray(arr: any, fieldName: string, minLength?: number): boolean
```

Validates that an array field is present and has minimum length.

**Example:**
```typescript
service.validateRequiredArray([1, 2, 3], 'Directors', 1); // ✓
service.validateRequiredArray([], 'Directors', 1); // ✗ Throws error
```

## Collecting Multiple Validation Errors

The `collectValidationErrors` method allows you to validate an entire form and collect all errors without throwing immediately:

```typescript
collectValidationErrors(validations: Array<() => void>): ValidationError[]
```

**Example:**
```typescript
const errors = service.collectValidationErrors([
  () => service.validateRequiredString(formData.businessName, 'Business Name'),
  () => service.validatePAN(formData.pan),
  () => service.validateEmail(formData.email, 'Email'),
  () => service.validatePhone(formData.phone, 'Phone'),
]);

if (errors.length > 0) {
  // Return all errors to user
  return { isValid: false, errors };
}
```

**Returns:**
```typescript
interface ValidationError {
  field: string;
  message: string;
}
```

## Usage in Lab Services

Lab services (GST, ITR, MCA) should extend the `LabValidationService` base class:

### Example: GST Lab Service

```typescript
import { Injectable } from '@nestjs/common';
import { LabValidationService } from './lab-validation.service';

@Injectable()
export class GstLabService extends LabValidationService {
  validateGstForm(formData: GstFormData): { isValid: boolean; errors: ValidationError[] } {
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

  async submitGstForm(studentId: string, formData: GstFormData) {
    const validation = this.validateGstForm(formData);
    
    if (!validation.isValid) {
      throw new BadRequestException({
        message: 'Form validation failed',
        errors: validation.errors,
      });
    }

    // Generate simulated GSTIN and ARN
    const result = {
      gstin: this.generateSimulatedGSTIN(formData.pan, formData.state),
      arn: this.generateSimulatedARN(),
      submittedAt: new Date(),
    };

    // Store lab attempt
    // ...

    return result;
  }

  private generateSimulatedGSTIN(pan: string, state: string): string {
    // Format: 00AAAAA0000A0Z0
    const stateCode = '00'; // Fictional state code
    const checksum = 'Z0';
    return `${stateCode}${pan}0${checksum}`;
  }

  private generateSimulatedARN(): string {
    // Format: AA000000000000000
    const prefix = 'AA';
    const randomDigits = Math.floor(Math.random() * 1e15).toString().padStart(15, '0');
    return `${prefix}${randomDigits}`;
  }
}
```

### Example: ITR Lab Service

```typescript
import { Injectable } from '@nestjs/common';
import { LabValidationService } from './lab-validation.service';

@Injectable()
export class ItrLabService extends LabValidationService {
  validateItrForm(formData: ItrFormData): { isValid: boolean; errors: ValidationError[] } {
    const errors = this.collectValidationErrors([
      () => this.validateRequiredString(formData.taxpayerName, 'Taxpayer Name'),
      () => this.validatePAN(formData.pan),
      () => this.validateRequiredString(formData.incomeSource, 'Income Source'),
      () => this.validateRequiredNumber(formData.grossIncome, 'Gross Income', { min: 0 }),
      () => this.validateRequiredNumber(formData.deductions, 'Deductions', { min: 0 }),
    ]);

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  async submitItrForm(studentId: string, formData: ItrFormData) {
    const validation = this.validateItrForm(formData);
    
    if (!validation.isValid) {
      throw new BadRequestException({
        message: 'Form validation failed',
        errors: validation.errors,
      });
    }

    // Calculate illustrative tax
    const taxableIncome = formData.grossIncome - formData.deductions;
    const taxAmount = this.calculateIllustrativeTax(taxableIncome);

    const result = {
      acknowledgementNumber: this.generateSimulatedAckNumber(),
      taxableIncome,
      taxAmount,
      submittedAt: new Date(),
    };

    // Store lab attempt
    // ...

    return result;
  }

  private calculateIllustrativeTax(taxableIncome: number): number {
    // Simplified illustrative tax calculation
    if (taxableIncome <= 250000) return 0;
    if (taxableIncome <= 500000) return (taxableIncome - 250000) * 0.05;
    if (taxableIncome <= 1000000) return 12500 + (taxableIncome - 500000) * 0.20;
    return 112500 + (taxableIncome - 1000000) * 0.30;
  }

  private generateSimulatedAckNumber(): string {
    // Format: 000000000000000 (15 digits)
    return Math.floor(Math.random() * 1e15).toString().padStart(15, '0');
  }
}
```

### Example: MCA Lab Service

```typescript
import { Injectable } from '@nestjs/common';
import { LabValidationService } from './lab-validation.service';

@Injectable()
export class McaLabService extends LabValidationService {
  validateMcaForm(formData: McaFormData): { isValid: boolean; errors: ValidationError[] } {
    const errors = this.collectValidationErrors([
      () => this.validateRequiredString(formData.companyName, 'Company Name'),
      () => this.validateRequiredArray(formData.directors, 'Directors', 1),
      () => this.validateRequiredString(formData.registeredAddress, 'Registered Address'),
      () => this.validateRequiredNumber(formData.authorizedCapital, 'Authorized Capital', { min: 0 }),
      // Validate each director
      ...formData.directors.flatMap((director, index) => [
        () => this.validateRequiredString(director.name, `Director ${index + 1} Name`),
        () => this.validateDIN(director.din),
        () => this.validateEmail(director.email, `Director ${index + 1} Email`),
      ]),
    ]);

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  async submitMcaForm(studentId: string, formData: McaFormData) {
    const validation = this.validateMcaForm(formData);
    
    if (!validation.isValid) {
      throw new BadRequestException({
        message: 'Form validation failed',
        errors: validation.errors,
      });
    }

    const result = {
      cin: this.generateSimulatedCIN(),
      certificateDate: new Date(),
      submittedAt: new Date(),
    };

    // Store lab attempt
    // ...

    return result;
  }

  private generateSimulatedCIN(): string {
    // Format: U00000TS0000PTC000000
    const prefix = 'U00000';
    const stateCode = 'TS';
    const year = '0000';
    const type = 'PTC';
    const number = Math.floor(Math.random() * 1e6).toString().padStart(6, '0');
    return `${prefix}${stateCode}${year}${type}${number}`;
  }
}
```

## Security Considerations

**CRITICAL SAFETY FEATURES:**

1. **PAN Validation** rejects realistic patterns matching `AAAAA0000A` format (5 letters, 4 digits, 1 letter) to prevent accidental use of real PANs
2. **DIN Validation** rejects realistic patterns with only 8 digits to prevent accidental use of real DINs
3. All lab simulations display prominent warnings: "This is a training simulation with no government connection"
4. Form submissions explicitly instruct learners never to enter real Aadhaar, PAN, or identity documents

These validations ensure the training system cannot be misused for filing real government documents.

## Testing

Comprehensive unit tests are provided in `lab-validation.service.spec.ts` covering:

- ✓ Fictional PAN patterns (accepted)
- ✓ Realistic PAN patterns (rejected)
- ✓ Fictional DIN patterns (accepted)
- ✓ Realistic DIN patterns (rejected)
- ✓ All field validators
- ✓ Error collection mechanism

Integration tests in `lab-validation.integration.spec.ts` demonstrate:

- ✓ Complete form validation for GST, ITR, MCA
- ✓ Extension pattern for specific lab services
- ✓ Multiple validation errors collection

Run tests with:
```bash
npm test -- lab-validation.service.spec.ts
```

## Module Integration

The `LabModule` exports the `LabValidationService` for use in other modules:

```typescript
import { Module } from '@nestjs/common';
import { LabModule } from './lab/lab.module';

@Module({
  imports: [LabModule],
  // ...
})
export class AppModule {}
```

Then inject into your service:

```typescript
import { Injectable } from '@nestjs/common';
import { LabValidationService } from './lab/lab-validation.service';

@Injectable()
export class GstLabService extends LabValidationService {
  // Your implementation
}
```

## Future Extensions

The validation framework can be extended with additional validators as needed:

- GSTIN validation (for GST return filing simulation)
- Aadhaar validation (for fictional Aadhaar patterns only)
- Company registration number validation
- Additional document type validations

All future validators should follow the same principle: **accept only fictional patterns, reject all realistic patterns**.
