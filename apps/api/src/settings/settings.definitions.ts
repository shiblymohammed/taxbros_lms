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
  // ---- Self attendance (staff check-in, student QR check-in) ----
  attendanceNetworks: {
    label: 'Institute network addresses',
    description:
      'Internet addresses of the institute Wi-Fi, separated by commas. Check-ins from these count as "at the institute". ' +
      'End with a dot to allow a range (e.g. 192.168.1.). Leave empty to use location only.',
    defaultValue: '',
    validate: (v: string) => {
      const parts = splitList(v);
      if (parts.some((p) => !/^[0-9a-f.:]{2,45}$/i.test(p))) return 'Use addresses like 103.21.4.17 or 192.168.1., separated by commas';
      return null;
    },
  },
  attendanceLocation: {
    label: 'Institute location',
    description: 'Latitude and longitude of the institute, e.g. 9.9312, 76.2673. Leave empty to use the network check only.',
    defaultValue: '',
    validate: (v: string) => (v.trim() === '' || parseLatLng(v) ? null : 'Enter latitude, longitude, e.g. 9.9312, 76.2673'),
  },
  attendanceRadiusMeters: {
    label: 'Allowed distance (metres)',
    description: 'How far from the institute location a check-in may be. Phone GPS is often 20–50 m off indoors.',
    defaultValue: '150',
    validate: (v: string) => integerIn(v, 20, 5000, 'Allowed distance'),
  },
  staffCheckInWindow: {
    label: 'Staff check-in hours',
    description: 'When staff can check in, in the institute timezone, e.g. 07:00-12:00.',
    defaultValue: '07:00-12:00',
    validate: (v: string) => {
      const w = parseTimeWindow(v);
      if (!w) return 'Use the form 07:00-12:00';
      return w.start < w.end ? null : 'The start time must be before the end time';
    },
  },
  staffLateAfter: {
    label: 'Staff late after',
    description: 'Staff who check in after this time are marked Late, e.g. 09:30.',
    defaultValue: '09:30',
    validate: (v: string) => (parseTime(v) === null ? 'Use the form 09:30' : null),
  },
  studentLateAfterMinutes: {
    label: 'Students late after (minutes)',
    description: 'Students who check in this many minutes after the teacher starts check-in are marked Late.',
    defaultValue: '10',
    validate: (v: string) => integerIn(v, 0, 180, 'Minutes'),
  },
  studentNetworkCheck: {
    label: 'Students must also be at the institute',
    description: '"on": a class code only works on the institute network or at its location. "off": the code is enough.',
    defaultValue: 'off',
    validate: (v: string) => (v === 'on' || v === 'off' ? null : 'Enter on or off'),
  },
} satisfies Record<string, SettingDefinition>;

/** Comma-separated list → trimmed, non-empty entries. */
export function splitList(value: string): string[] {
  return value
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
}

/** "9.9312, 76.2673" → coordinates, or null when not valid. */
export function parseLatLng(value: string): { latitude: number; longitude: number } | null {
  const parts = value.split(',').map((p) => p.trim());
  if (parts.length !== 2 || parts.some((p) => !/^-?\d+(\.\d+)?$/.test(p))) return null;
  const [latitude, longitude] = parts.map(Number);
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  return { latitude, longitude };
}

/** "09:30" → minutes after midnight, or null. */
export function parseTime(value: string): number | null {
  const m = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(value.trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

/** "07:00-12:00" → minutes after midnight, or null. */
export function parseTimeWindow(value: string): { start: number; end: number } | null {
  const parts = value.split('-');
  if (parts.length !== 2) return null;
  const start = parseTime(parts[0]);
  const end = parseTime(parts[1]);
  return start === null || end === null ? null : { start, end };
}

function integerIn(value: string, min: number, max: number, name: string): string | null {
  if (!/^\d+$/.test(value.trim())) return `${name} must be a whole number`;
  const n = Number(value);
  return n < min || n > max ? `${name} must be between ${min} and ${max}` : null;
}

export type SettingKey = keyof typeof SETTING_DEFINITIONS;

export function isSettingKey(key: string): key is SettingKey {
  return Object.prototype.hasOwnProperty.call(SETTING_DEFINITIONS, key);
}
