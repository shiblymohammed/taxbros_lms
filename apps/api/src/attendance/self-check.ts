import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { parseLatLng, splitList } from '../settings/settings.definitions';

/**
 * Rules for self attendance, kept free of the database so they are easy to test:
 * "is this person at the institute?" and the rotating class code.
 */

/** A class code is valid for this long; the previous code is also accepted, so up to twice this. */
export const CODE_STEP_MS = 30_000;

export interface PlaceRules {
  networks: string[];
  location: { latitude: number; longitude: number } | null;
  radiusMeters: number;
}

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export function placeRules(values: { attendanceNetworks: string; attendanceLocation: string; attendanceRadiusMeters: string }): PlaceRules {
  return {
    networks: splitList(values.attendanceNetworks),
    location: values.attendanceLocation.trim() ? parseLatLng(values.attendanceLocation) : null,
    radiusMeters: Number(values.attendanceRadiusMeters) || 150,
  };
}

/** "::ffff:192.168.1.5" → "192.168.1.5" (IPv4 seen through an IPv6 socket). */
export function normalizeIp(ip: string | undefined | null): string {
  if (!ip) return '';
  const trimmed = ip.trim();
  return trimmed.startsWith('::ffff:') ? trimmed.slice(7) : trimmed;
}

/** Exact address, or a range written as a prefix ending in "." or ":" (e.g. "192.168.1."). */
export function ipAllowed(ip: string, networks: string[]): boolean {
  const address = normalizeIp(ip);
  if (!address) return false;
  return networks.some((n) => (n.endsWith('.') || n.endsWith(':') ? address.startsWith(n) : address === normalizeIp(n)));
}

/** Great-circle distance in metres (haversine). */
export function distanceMeters(a: Coordinates, b: Coordinates): number {
  const R = 6_371_000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLng = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export type PlaceCheck =
  | { ok: true; via: 'network' | 'location' }
  | { ok: false; reason: 'NOT_SET_UP' | 'NEED_LOCATION' | 'NOT_AT_INSTITUTE'; distanceMeters?: number };

/** At the institute = on one of its networks, or within the allowed distance of its location. */
export function checkPlace(rules: PlaceRules, ip: string, coords?: Coordinates | null): PlaceCheck {
  if (rules.networks.length === 0 && !rules.location) return { ok: false, reason: 'NOT_SET_UP' };
  if (rules.networks.length > 0 && ipAllowed(ip, rules.networks)) return { ok: true, via: 'network' };
  if (rules.location) {
    if (!coords) return { ok: false, reason: 'NEED_LOCATION' };
    const d = distanceMeters(rules.location, coords);
    if (d <= rules.radiusMeters) return { ok: true, via: 'location' };
    return { ok: false, reason: 'NOT_AT_INSTITUTE', distanceMeters: Math.round(d) };
  }
  return { ok: false, reason: 'NOT_AT_INSTITUTE' };
}

export function newCheckInSecret(): string {
  return randomBytes(32).toString('hex');
}

export function codeStep(now: number = Date.now()): number {
  return Math.floor(now / CODE_STEP_MS);
}

/** Six-digit code for one register and one 30-second step. */
export function classCode(secret: string, registerId: string, step: number): string {
  const digest = createHmac('sha256', secret).update(`${registerId}:${step}`).digest();
  return (digest.readUInt32BE(0) % 1_000_000).toString().padStart(6, '0');
}

/** The current code or the one just before it (a student may scan as it changes). */
export function codeMatches(secret: string, registerId: string, code: string, now: number = Date.now()): boolean {
  const given = Buffer.from(code.trim());
  if (!/^\d{6}$/.test(code.trim())) return false;
  const step = codeStep(now);
  return [step, step - 1].some((s) => {
    const expected = Buffer.from(classCode(secret, registerId, s));
    return expected.length === given.length && timingSafeEqual(expected, given);
  });
}
