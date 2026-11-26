import { apiClient, type AttendanceRegister, type AttendanceStatus } from './api';

/** Self attendance: staff check-in/out, the class QR session and student check-in. */

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface StaffSelfRecord {
  date: string;
  status: AttendanceStatus;
  source: 'MARKED' | 'SELF_QR' | 'SELF_CHECK_IN';
  checkInAt: string | null;
  checkOutAt: string | null;
  checkInVia: 'network' | 'location' | null;
  remarks: string | null;
}

export interface StaffToday {
  date: string;
  record: StaffSelfRecord | null;
  window: { start: string; end: string };
  lateAfter: string;
  open: boolean;
  setUp: boolean;
  usesLocation: boolean;
  onInstituteNetwork: boolean;
}

export interface ClassCheckInState {
  registerId: string;
  className: string;
  date: string;
  open: boolean;
  openedAt: string | null;
  closedAt: string | null;
  code: string | null;
  expiresInMs: number | null;
  lateAfterMinutes: number;
  total: number;
  checkedIn: number;
  marked: number;
}

export interface StudentToday {
  date: string;
  requiresPlace: boolean;
  usesLocation: boolean;
  classes: Array<{
    registerId: string;
    className: string;
    open: boolean;
    status: AttendanceStatus | null;
    markedAt: string | null;
    selfMarked: boolean;
  }>;
}

export interface StudentCheckInResult {
  className: string;
  date: string;
  status: AttendanceStatus;
  markedAt: string;
  alreadyMarked: boolean;
}

export const selfAttendanceApi = {
  network: async (): Promise<{ ip: string }> => (await apiClient.get('/attendance/self/network')).data,

  staffToday: async (): Promise<StaffToday> => (await apiClient.get('/attendance/self/staff/today')).data,
  staffCheckIn: async (coords?: Coordinates | null): Promise<StaffSelfRecord> =>
    (await apiClient.post('/attendance/self/staff/check-in', coords ?? {})).data,
  staffCheckOut: async (coords?: Coordinates | null): Promise<StaffSelfRecord> =>
    (await apiClient.post('/attendance/self/staff/check-out', coords ?? {})).data,

  startClass: async (registerId: string): Promise<ClassCheckInState> =>
    (await apiClient.post(`/attendance/student/registers/${registerId}/self-check-in/start`)).data,
  classState: async (registerId: string): Promise<ClassCheckInState> =>
    (await apiClient.get(`/attendance/student/registers/${registerId}/self-check-in`)).data,
  closeClass: async (registerId: string): Promise<AttendanceRegister> =>
    (await apiClient.post(`/attendance/student/registers/${registerId}/self-check-in/close`)).data,

  studentToday: async (): Promise<StudentToday> => (await apiClient.get('/attendance/self/student/today')).data,
  studentCheckIn: async (code: string, registerId?: string | null, coords?: Coordinates | null): Promise<StudentCheckInResult> =>
    (
      await apiClient.post('/attendance/self/student/check-in', {
        code,
        ...(registerId ? { registerId } : {}),
        ...(coords ?? {}),
      })
    ).data,
};

/** The page students open from the QR code (works with any phone camera app). */
export function checkInLink(origin: string, registerId: string, code: string): string {
  return `${origin}/student/check-in?r=${encodeURIComponent(registerId)}&c=${encodeURIComponent(code)}`;
}

/**
 * Device location, or null when unavailable or refused (the server then relies on the network check).
 * Waits at most `timeoutMs`.
 */
export function currentLocation(timeoutMs = 10_000): Promise<Coordinates | null> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return Promise.resolve(null);
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 60_000 },
    );
  });
}

/** Error code the API sends with a refusal (e.g. LOCATION_REQUIRED). */
export function apiErrorCode(err: unknown): string | undefined {
  return (err as { response?: { data?: { code?: string } } })?.response?.data?.code;
}

/** "9:12 am" in the institute timezone. */
export function clockTime(value: string | null | undefined, timeZone: string): string {
  if (!value) return '';
  return new Intl.DateTimeFormat('en-IN', { timeZone, hour: 'numeric', minute: '2-digit' }).format(new Date(value));
}
