import { describe, expect, it } from 'vitest';
import {
  calculateIllustrativeTax,
  getApiErrorMessage,
  validateFictionalDin,
  validateFictionalPan,
  validateSampleData,
} from './lab-validation';

describe('validateFictionalPan (mirrors API LabValidationService)', () => {
  it.each(['TEST00000T', 'DEMO98765D', 'TRAIN0000R', 'LEARN0000L', 'TEST12345T', 'XXX000000X'])(
    'accepts fictional PAN %s',
    (pan) => expect(validateFictionalPan(pan)).toBeNull(),
  );

  it('rejects a real-looking PAN', () => {
    expect(validateFictionalPan('ABCDE1234F')).toMatch(/Real-looking/);
  });

  it('rejects wrong length and symbols', () => {
    expect(validateFictionalPan('TEST1')).toMatch(/10 characters/);
    expect(validateFictionalPan('TEST-0000T')).toMatch(/letters and numbers/);
    expect(validateFictionalPan('')).toMatch(/required/);
  });
});

describe('validateFictionalDin', () => {
  it('accepts fictional DINs', () => {
    expect(validateFictionalDin('TEST0001')).toBeNull();
    expect(validateFictionalDin('demo0001')).toBeNull();
  });

  it('rejects all-digit (real-looking) DINs', () => {
    expect(validateFictionalDin('01234567')).toMatch(/Real-looking/);
  });

  it('rejects wrong length', () => {
    expect(validateFictionalDin('TEST1')).toMatch(/8 characters/);
  });
});

describe('calculateIllustrativeTax (same slabs as ItrLabService)', () => {
  // Expected values taken from apps/api/src/lab/itr-lab.service.spec.ts
  it('no tax up to 2.5L', () => {
    const r = calculateIllustrativeTax(300000, 100000);
    expect(r.taxableIncome).toBe(200000);
    expect(r.taxAmount).toBe(0);
    expect(r.taxBrackets).toHaveLength(0);
  });

  it('5% slab', () => {
    const r = calculateIllustrativeTax(400000, 50000);
    expect(r.taxAmount).toBe(5000);
    expect(r.taxBrackets).toEqual([{ from: 250000, to: 500000, rate: 5, taxOnBracket: 5000 }]);
  });

  it('spans 5% and 20% slabs', () => {
    const r = calculateIllustrativeTax(600000, 50000);
    expect(r.taxableIncome).toBe(550000);
    expect(r.taxAmount).toBe(22500);
    expect(r.taxBrackets).toHaveLength(2);
  });

  it('all slabs for high income', () => {
    const r = calculateIllustrativeTax(1500000, 100000);
    expect(r.taxableIncome).toBe(1400000);
    expect(r.taxAmount).toBe(232500);
    expect(r.taxBrackets).toHaveLength(3);
  });

  it('never goes negative', () => {
    expect(calculateIllustrativeTax(100, 500).taxableIncome).toBe(0);
  });
});

describe('validateSampleData (admin validation preview)', () => {
  it('accepts the seeded GST sample', () => {
    expect(
      validateSampleData('GST_REGISTRATION', {
        businessName: 'Test Business Pvt Ltd',
        businessType: 'Private Limited',
        pan: 'TEST12345T',
        address: '123 Fictional Street',
        signatory: 'John Doe Test',
      }),
    ).toEqual([]);
  });

  it('flags a real-looking PAN and missing fields', () => {
    const problems = validateSampleData('INCOME_TAX_RETURN', { pan: 'ABCDE1234F', grossIncome: 10, deductions: 20 });
    expect(problems.some((p) => p.startsWith('pan:'))).toBe(true);
    expect(problems).toContain('taxpayerName is required');
    expect(problems).toContain('deductions cannot exceed grossIncome');
  });

  it('validates MCA directors', () => {
    const problems = validateSampleData('MCA_INCORPORATION', {
      companyName: 'X Pvt Ltd',
      registeredAddress: 'Somewhere',
      authorizedCapital: 100000,
      directors: [{ name: 'A', din: '12345678' }],
    });
    expect(problems).toEqual([expect.stringMatching(/^directors\[0\]\.din: Real-looking/)]);
    expect(validateSampleData('MCA_INCORPORATION', { companyName: 'X', registeredAddress: 'Y', authorizedCapital: 1, directors: [] }))
      .toContain('directors must be a non-empty array');
  });

  it('rejects non-objects', () => {
    expect(validateSampleData('GST_REGISTRATION', [1, 2])).toEqual(['Sample data must be a JSON object']);
  });
});

describe('getApiErrorMessage', () => {
  it('joins field errors from MCA validation responses', () => {
    const err = { response: { data: { message: 'Form validation failed', errors: [{ message: 'A' }, { message: 'B' }] } } };
    expect(getApiErrorMessage(err)).toBe('A; B');
  });

  it('joins class-validator message arrays', () => {
    expect(getApiErrorMessage({ response: { data: { message: ['x', 'y'] } } })).toBe('x; y');
  });

  it('handles network errors and fallbacks', () => {
    expect(getApiErrorMessage({ message: 'Network Error' })).toMatch(/Cannot reach/);
    expect(getApiErrorMessage({}, 'fallback')).toBe('fallback');
  });
});
