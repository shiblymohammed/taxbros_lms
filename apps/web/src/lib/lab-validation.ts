/**
 * Client-side validation for the government-portal training labs.
 *
 * These rules mirror apps/api/src/lab/lab-validation.service.ts and
 * itr-lab.service.ts so students get the same feedback before submitting.
 * The server remains the source of truth.
 *
 * Requirements: R28, R29, R30
 */

export const FICTIONAL_PAN_PREFIXES = ['TEST0', 'DEMO0', 'TRAIN', 'LEARN', 'PRACT', 'SAMPL'];

/** Returns an error message, or null when the PAN is an acceptable fictional value. */
export function validateFictionalPan(value: string): string | null {
  const pan = (value ?? '').trim().toUpperCase();
  if (!pan) return 'PAN is required';
  if (pan.length !== 10) return 'PAN must be exactly 10 characters';
  if (!/^[A-Z0-9]{10}$/.test(pan)) return 'PAN must contain only letters and numbers';

  const looksReal = /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan);
  if (looksReal && !FICTIONAL_PAN_PREFIXES.some((p) => pan.startsWith(p))) {
    return 'Real-looking PANs are not allowed. Use a fictional one such as TEST00000T or TRAIN0000R';
  }
  return null;
}

/** Returns an error message, or null when the DIN is an acceptable fictional value. */
export function validateFictionalDin(value: string): string | null {
  const din = (value ?? '').trim().toUpperCase();
  if (!din) return 'DIN is required';
  if (din.length !== 8) return 'DIN must be exactly 8 characters';
  if (/^[0-9]{8}$/.test(din)) {
    return 'Real-looking DINs are not allowed. Use a fictional one such as TEST0001';
  }
  if (!/^[A-Z0-9]{8}$/.test(din)) return 'DIN must contain only letters and numbers';
  return null;
}

export function validateEmail(value: string): string | null {
  const email = (value ?? '').trim();
  if (!email) return 'Email is required';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Enter a valid email address';
  return null;
}

export function requiredText(value: unknown, label: string): string | null {
  return typeof value === 'string' && value.trim() ? null : `${label} is required`;
}

export function nonNegativeNumber(value: unknown, label: string): string | null {
  if (value === '' || value === null || value === undefined) return `${label} is required`;
  const n = Number(value);
  if (!Number.isFinite(n)) return `${label} must be a number`;
  if (n < 0) return `${label} cannot be negative`;
  return null;
}

// ---------------------------------------------------------------------------
// ITR illustrative tax calculation (same simplified slabs as the API)
// ---------------------------------------------------------------------------

export interface TaxBracketRow {
  from: number;
  to: number | null;
  rate: number;
  taxOnBracket: number;
}

export interface TaxPreview {
  grossIncome: number;
  deductions: number;
  taxableIncome: number;
  taxAmount: number;
  taxBrackets: TaxBracketRow[];
}

export const ILLUSTRATIVE_TAX_SLABS: Array<{ from: number; to: number | null; rate: number }> = [
  { from: 0, to: 250000, rate: 0 },
  { from: 250000, to: 500000, rate: 5 },
  { from: 500000, to: 1000000, rate: 20 },
  { from: 1000000, to: null, rate: 30 },
];

export function calculateIllustrativeTax(grossIncome: number, deductions: number): TaxPreview {
  const gross = Math.max(0, Number(grossIncome) || 0);
  const ded = Math.max(0, Number(deductions) || 0);
  const taxableIncome = Math.max(0, gross - ded);

  let total = 0;
  const taxBrackets: TaxBracketRow[] = [];

  for (const slab of ILLUSTRATIVE_TAX_SLABS) {
    if (taxableIncome <= slab.from) break;
    const upper = slab.to ?? Infinity;
    const inSlab = Math.min(taxableIncome, upper) - slab.from;
    const tax = (inSlab * slab.rate) / 100;
    total += tax;
    if (slab.rate > 0) {
      taxBrackets.push({ from: slab.from, to: slab.to, rate: slab.rate, taxOnBracket: Math.round(tax) });
    }
  }

  return { grossIncome: gross, deductions: ded, taxableIncome, taxAmount: Math.round(total), taxBrackets };
}

export function formatINR(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

// ---------------------------------------------------------------------------
// Sample-data validation used by the admin lab editor ("validation preview")
// ---------------------------------------------------------------------------

export type LabTypeKey = 'GST_REGISTRATION' | 'INCOME_TAX_RETURN' | 'MCA_INCORPORATION';

/** Validate a lab's sample data. Returns a list of human-readable problems (empty = valid). */
export function validateSampleData(type: LabTypeKey, data: unknown): string[] {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return ['Sample data must be a JSON object'];
  }
  const d = data as Record<string, any>;
  const problems: (string | null)[] = [];

  switch (type) {
    case 'GST_REGISTRATION':
      problems.push(
        requiredText(d.businessName, 'businessName'),
        requiredText(d.businessType, 'businessType'),
        d.pan === undefined ? 'pan is required' : prefix('pan', validateFictionalPan(d.pan)),
        requiredText(d.address, 'address'),
        requiredText(d.signatory, 'signatory'),
      );
      break;

    case 'INCOME_TAX_RETURN':
      problems.push(
        requiredText(d.taxpayerName, 'taxpayerName'),
        d.pan === undefined ? 'pan is required' : prefix('pan', validateFictionalPan(d.pan)),
        requiredText(d.incomeSource, 'incomeSource'),
        nonNegativeNumber(d.grossIncome, 'grossIncome'),
        nonNegativeNumber(d.deductions, 'deductions'),
      );
      if (Number(d.deductions) > Number(d.grossIncome)) {
        problems.push('deductions cannot exceed grossIncome');
      }
      break;

    case 'MCA_INCORPORATION':
      problems.push(
        requiredText(d.companyName, 'companyName'),
        requiredText(d.registeredAddress, 'registeredAddress'),
        nonNegativeNumber(d.authorizedCapital, 'authorizedCapital'),
      );
      if (!Array.isArray(d.directors) || d.directors.length === 0) {
        problems.push('directors must be a non-empty array');
      } else {
        d.directors.forEach((dir: any, i: number) => {
          problems.push(
            requiredText(dir?.name, `directors[${i}].name`),
            prefix(`directors[${i}].din`, validateFictionalDin(dir?.din ?? '')),
          );
          if (dir?.email !== undefined && dir.email !== '') {
            problems.push(prefix(`directors[${i}].email`, validateEmail(dir.email)));
          }
        });
      }
      break;
  }

  return problems.filter((p): p is string => Boolean(p));
}

function prefix(field: string, message: string | null): string | null {
  return message ? `${field}: ${message}` : null;
}

/** Extract a readable message from an axios/Nest error response. */
export function getApiErrorMessage(err: any, fallback = 'Something went wrong'): string {
  const data = err?.response?.data;
  if (Array.isArray(data?.errors) && data.errors.length) {
    return data.errors.map((e: any) => e.message ?? String(e)).join('; ');
  }
  // Nest may nest the payload: { message: { message, errors } }
  if (data?.message && typeof data.message === 'object') {
    const inner = data.message;
    if (Array.isArray(inner.errors) && inner.errors.length) {
      return inner.errors.map((e: any) => e.message ?? String(e)).join('; ');
    }
    if (typeof inner.message === 'string') return inner.message;
  }
  if (Array.isArray(data?.message)) return data.message.join('; ');
  if (typeof data?.message === 'string') return data.message;
  if (err?.response?.status === 429) return 'Too many requests. Please wait a moment and try again.';
  if (err?.message === 'Network Error') return 'Cannot reach the server. Check your connection.';
  return fallback;
}
