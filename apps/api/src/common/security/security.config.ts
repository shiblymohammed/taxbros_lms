import type { HelmetOptions } from 'helmet';

/**
 * Security configuration (Task 70, R2, R38).
 */

const ONE_YEAR_SECONDS = 365 * 24 * 60 * 60;

/**
 * CORS_ORIGIN is a comma-separated list of exact origins (scheme + host + optional port).
 * Production refuses to start without one, and never accepts "*" (cookies need an explicit origin).
 */
export function parseCorsOrigins(value: string | undefined, nodeEnv: string | undefined): string[] {
  const origins = (value ?? '')
    .split(',')
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter(Boolean);

  if (nodeEnv === 'production') {
    if (origins.length === 0) {
      throw new Error('CORS_ORIGIN must be set in production (e.g. https://lms.example.com)');
    }
    if (origins.includes('*')) {
      throw new Error('CORS_ORIGIN cannot be "*" in production: list the web app origin(s)');
    }
    const insecure = origins.filter((o) => o.startsWith('http://'));
    if (insecure.length) {
      throw new Error(`CORS_ORIGIN must use https in production: ${insecure.join(', ')}`);
    }
  }

  return origins.length ? origins : ['http://localhost:3000'];
}

/**
 * Helmet headers for the API. Responses are JSON, so the CSP is strict; the only HTML the API
 * serves is the Swagger UI at /api/docs, which needs inline scripts and styles.
 */
export function buildHelmetOptions(): HelmetOptions {
  return {
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:'],
        fontSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
      },
    },
    strictTransportSecurity: { maxAge: ONE_YEAR_SECONDS, includeSubDomains: true },
    // Course covers under /uploads are fetched by the web app's server (Next.js rewrite), same site
    crossOriginResourcePolicy: { policy: 'same-site' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  };
}

/** Swagger UI is on by default outside production; set SWAGGER_ENABLED=true to expose it in production. */
export function isSwaggerEnabled(value: string | undefined, nodeEnv: string | undefined): boolean {
  if (value !== undefined && value !== '') return value === 'true';
  return nodeEnv !== 'production';
}

const WEAK_SECRET = /change|secret-key|development|example|your-/i;

/**
 * Production must have strong, distinct JWT secrets. Without this, a missing JWT_SECRET would fall
 * back to the development default and anyone could sign valid access tokens.
 * Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
 */
export function assertProductionSecrets(env: NodeJS.ProcessEnv): void {
  if (env.NODE_ENV !== 'production') return;
  const problems: string[] = [];
  for (const key of ['JWT_SECRET', 'JWT_REFRESH_SECRET'] as const) {
    const value = env[key];
    if (!value) problems.push(`${key} is not set`);
    else if (value.length < 32) problems.push(`${key} must be at least 32 characters (256-bit random)`);
    else if (WEAK_SECRET.test(value)) problems.push(`${key} still looks like the example value`);
  }
  if (env.JWT_SECRET && env.JWT_SECRET === env.JWT_REFRESH_SECRET) {
    problems.push('JWT_SECRET and JWT_REFRESH_SECRET must be different');
  }
  if (problems.length) {
    throw new Error(`Refusing to start in production: ${problems.join('; ')}`);
  }
}
