import { randomInt } from 'crypto';

/**
 * Password rules (R36.2): at least 8 characters, one uppercase letter, one number, one special character.
 */
export const PASSWORD_POLICY_REGEX = /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,128}$/;
export const PASSWORD_POLICY_MESSAGE =
  'Password must be at least 8 characters and include an uppercase letter, a number and a special character';

export function meetsPasswordPolicy(password: string): boolean {
  return PASSWORD_POLICY_REGEX.test(password);
}

const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const LOWER = 'abcdefghijkmnpqrstuvwxyz';
const DIGITS = '23456789';
const SPECIAL = '#$%@!*?';

/**
 * Temporary password for admin resets (R36.4): 12 characters from a cryptographic RNG,
 * always meeting the policy, without look-alike characters (0/O, 1/l/I).
 */
export function generateTemporaryPassword(length = 12): string {
  const all = UPPER + LOWER + DIGITS + SPECIAL;
  const chars = [
    UPPER[randomInt(UPPER.length)],
    LOWER[randomInt(LOWER.length)],
    DIGITS[randomInt(DIGITS.length)],
    SPECIAL[randomInt(SPECIAL.length)],
  ];
  while (chars.length < length) chars.push(all[randomInt(all.length)]);
  // Fisher-Yates shuffle so the required characters aren't always first
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

/** Routes a user who must change their password may still call. */
export const PASSWORD_CHANGE_ALLOWED_PATHS = /\/auth\/(me|change-password|logout)(\?|$)/;
export const PASSWORD_CHANGE_REQUIRED_CODE = 'PASSWORD_CHANGE_REQUIRED';
