/**
 * Redaction helpers for log output (Requirement R39.4).
 * Passwords, tokens, secrets, cookies and auth headers never reach the logs.
 */

export const MASK = '[REDACTED]';

const SENSITIVE_KEY = /pass(word)?|token|secret|authorization|cookie|api[-_]?key|jwt/i;

// Inline patterns (e.g. "Bearer eyJ...", JWT-looking strings) inside free text
const BEARER_PATTERN = /(Bearer\s+)[A-Za-z0-9\-._~+/]+=*/gi;
const JWT_PATTERN = /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g;

export function maskString(value: string): string {
  return value.replace(BEARER_PATTERN, `$1${MASK}`).replace(JWT_PATTERN, MASK);
}

/** Deep-copy `value`, replacing sensitive fields. Safe for cycles and very deep objects. */
export function maskSensitive<T>(value: T, depth = 0, seen = new WeakSet<object>()): T {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return maskString(value) as unknown as T;
  if (typeof value !== 'object') return value;
  if (value instanceof Date) return value;
  if (depth > 8) return '[Truncated]' as unknown as T;
  if (seen.has(value as object)) return '[Circular]' as unknown as T;
  seen.add(value as object);

  if (Array.isArray(value)) {
    return value.map((v) => maskSensitive(v, depth + 1, seen)) as unknown as T;
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: maskString(value.message),
      stack: value.stack ? maskString(value.stack) : undefined,
    } as unknown as T;
  }

  const out: Record<string, unknown> = {};
  for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
    out[key] = SENSITIVE_KEY.test(key) ? MASK : maskSensitive(v, depth + 1, seen);
  }
  return out as T;
}
