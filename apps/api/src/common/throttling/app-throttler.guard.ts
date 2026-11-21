import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import {
  InjectThrottlerOptions,
  InjectThrottlerStorage,
  ThrottlerException,
  ThrottlerGuard,
  type ThrottlerGenerateKeyFunction,
  type ThrottlerGetTrackerFunction,
  type ThrottlerModuleOptions,
  type ThrottlerOptions,
  type ThrottlerStorage,
} from '@nestjs/throttler';

import { THROTTLER_NAMES } from './throttler.config';

/** Mirrors the (non-exported) ThrottlerLimitDetail; times are in seconds. */
interface LimitDetail {
  timeToExpire: number;
  timeToBlockExpire?: number;
}

/**
 * Global rate-limit guard (Task 61, Requirement R38)
 *
 * - "user" throttler buckets by the authenticated user id. Global guards run
 *   before route-level JwtAuthGuard, so the access token is verified here
 *   (signature checked, so a forged token cannot drain another user's quota).
 *   Anonymous requests fall back to the client IP.
 * - "ip" and "login" throttlers bucket by client IP.
 * - Responds 429 with a standard `Retry-After` header in seconds.
 */
@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  constructor(
    @InjectThrottlerOptions() options: ThrottlerModuleOptions,
    @InjectThrottlerStorage() storageService: ThrottlerStorage,
    reflector: Reflector,
    private readonly jwtService: JwtService,
  ) {
    super(options, storageService, reflector);
  }

  protected async handleRequest(
    context: ExecutionContext,
    limit: number,
    ttl: number,
    throttler: ThrottlerOptions,
    getTracker: ThrottlerGetTrackerFunction,
    generateKey: ThrottlerGenerateKeyFunction,
  ): Promise<boolean> {
    const tracker: ThrottlerGetTrackerFunction =
      throttler.name === THROTTLER_NAMES.user ? (req) => this.userTracker(req) : getTracker;
    return super.handleRequest(context, limit, ttl, throttler, tracker, generateKey);
  }

  protected async getTracker(req: Record<string, any>): Promise<string> {
    return `ip:${this.clientIp(req)}`;
  }

  protected async throwThrottlingException(
    context: ExecutionContext,
    detail: LimitDetail,
  ): Promise<void> {
    const res = context.switchToHttp().getResponse();
    const seconds = Math.max(1, Math.ceil(Math.max(detail.timeToBlockExpire ?? 0, detail.timeToExpire ?? 0)));
    res.header('Retry-After', String(seconds));
    throw new ThrottlerException(`Too many requests. Please try again in ${seconds} second(s).`);
  }

  private async userTracker(req: Record<string, any>): Promise<string> {
    const header: unknown = req.headers?.authorization;
    if (typeof header === 'string' && header.startsWith('Bearer ')) {
      try {
        const payload = await this.jwtService.verifyAsync<{ sub?: string }>(header.slice(7));
        if (payload?.sub) return `user:${payload.sub}`;
      } catch {
        // Invalid/expired token: JwtAuthGuard will reject it; count it against the IP
      }
    }
    return `ip:${this.clientIp(req)}`;
  }

  private clientIp(req: Record<string, any>): string {
    return req.ip ?? req.ips?.[0] ?? req.socket?.remoteAddress ?? 'unknown';
  }
}
