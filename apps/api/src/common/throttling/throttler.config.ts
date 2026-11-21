import type { ExecutionContext } from '@nestjs/common';
import type { ThrottlerOptions } from '@nestjs/throttler';

/**
 * API rate limits (Task 61, Requirement R38)
 *
 *  - user : 100 requests / minute per authenticated user (R38.1)
 *  - ip   : 500 requests / minute per client IP          (R38.2)
 *  - login: 5 attempts / 15 minutes per client IP on POST /auth/login (R38.5)
 *
 * All limits can be tuned with environment variables without a code change.
 * NOTE: an institute classroom often shares one public IP. If many students
 * sign in at once from the same network, raise LOGIN_RATE_LIMIT /
 * IP_RATE_LIMIT, and set TRUST_PROXY behind Nginx so real client IPs are used.
 */

const MINUTE = 60_000;

const num = (value: string | undefined, fallback: number) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

export const THROTTLER_NAMES = { user: 'user', ip: 'ip', login: 'login' } as const;

export function isLoginRequest(context: ExecutionContext): boolean {
  const req = context.switchToHttp().getRequest();
  const path: string = req?.originalUrl ?? req?.url ?? '';
  return req?.method === 'POST' && /\/auth\/login\/?(\?|$)/.test(path);
}

export function buildThrottlers(env: NodeJS.ProcessEnv = process.env): ThrottlerOptions[] {
  return [
    {
      name: THROTTLER_NAMES.user,
      ttl: MINUTE,
      limit: num(env.USER_RATE_LIMIT, 100),
    },
    {
      name: THROTTLER_NAMES.ip,
      ttl: MINUTE,
      limit: num(env.IP_RATE_LIMIT, 500),
    },
    {
      name: THROTTLER_NAMES.login,
      ttl: num(env.LOGIN_RATE_WINDOW_MINUTES, 15) * MINUTE,
      limit: num(env.LOGIN_RATE_LIMIT, 5),
      skipIf: (context) => !isLoginRequest(context),
    },
  ];
}
