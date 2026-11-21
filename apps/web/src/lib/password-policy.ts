/** Mirrors apps/api/src/auth/password-policy.ts (R36.2). */
export const PASSWORD_RULES: Array<{ id: string; label: string; test: (p: string) => boolean }> = [
  { id: 'length', label: 'At least 8 characters', test: (p) => p.length >= 8 },
  { id: 'upper', label: 'An uppercase letter', test: (p) => /[A-Z]/.test(p) },
  { id: 'number', label: 'A number', test: (p) => /\d/.test(p) },
  { id: 'special', label: 'A special character (e.g. # $ % @ !)', test: (p) => /[^A-Za-z0-9]/.test(p) },
];

export function meetsPasswordPolicy(password: string): boolean {
  return password.length <= 128 && PASSWORD_RULES.every((r) => r.test(password));
}

export const PASSWORD_CHANGE_REQUIRED_CODE = 'PASSWORD_CHANGE_REQUIRED';
