import { DEFAULT_TIMEZONE, isValidTimezone } from '../common/dates/institute-dates';

/**
 * The institute settings an administrator can change (R6.2).
 * Each key has a default and a validator; unknown keys are rejected.
 */
export interface SettingDefinition {
  label: string;
  description: string;
  defaultValue: string;
  /** Returns an error message, or null when the value is allowed. */
  validate: (value: string) => string | null;
}

export const SETTING_DEFINITIONS = {
  timezone: {
    label: 'Institute timezone',
    description: 'Used for attendance dates and for showing times (IANA name, e.g. Asia/Kolkata).',
    defaultValue: DEFAULT_TIMEZONE,
    validate: (v: string) => (isValidTimezone(v) ? null : 'Timezone must be a valid IANA name, e.g. Asia/Kolkata'),
  },
  instituteName: {
    label: 'Institute name',
    description: 'Shown in the app and on reports.',
    defaultValue: 'TaxBros Academy',
    validate: (v: string) => {
      const t = v.trim();
      if (t.length < 2) return 'Institute name must be at least 2 characters';
      if (t.length > 100) return 'Institute name must be at most 100 characters';
      return null;
    },
  },
} satisfies Record<string, SettingDefinition>;

export type SettingKey = keyof typeof SETTING_DEFINITIONS;

export function isSettingKey(key: string): key is SettingKey {
  return Object.prototype.hasOwnProperty.call(SETTING_DEFINITIONS, key);
}
