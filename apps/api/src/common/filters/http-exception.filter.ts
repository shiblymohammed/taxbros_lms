import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AppLogger } from '../logging/app-logger.service';

/**
 * Standard error responses + error logging (Task 60, Requirement R39)
 *
 * Response shape (unchanged fields from Nest are preserved, so existing clients keep working):
 *   { statusCode, error, message, ...extra, path, timestamp }
 *
 * Logging:
 *   - 5xx / unexpected errors  -> ERROR with userId, path, message, stack   (R39.1)
 *   - failed login (401/429)    -> WARN with attempted email and IP          (R39.2)
 *   - 403 permission denial     -> WARN with userId, resource, permission    (R39.3)
 *   - unexpected errors never leak internals to the client
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: AppLogger) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request & { user?: any; requiredPermissions?: string[] }>();

    const isHttp = exception instanceof HttpException;
    const status = isHttp ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    const body = this.buildBody(exception, status, req.originalUrl ?? req.url);
    this.log(exception, status, req, body.message);

    if (!res.headersSent) {
      res.status(status).json(body);
    }
  }

  private buildBody(exception: unknown, status: number, path: string) {
    const timestamp = new Date().toISOString();

    if (exception instanceof HttpException) {
      const response = exception.getResponse();
      const base =
        typeof response === 'string'
          ? { statusCode: status, message: response }
          : { statusCode: status, ...(response as Record<string, unknown>) };
      return {
        error: statusLabel(status),
        ...base,
        path,
        timestamp,
      } as Record<string, unknown> & { message?: unknown };
    }

    // Never expose stack traces or driver messages to clients
    return {
      statusCode: status,
      error: 'Internal Server Error',
      message: 'An unexpected error occurred. Please try again later.',
      path,
      timestamp,
    };
  }

  private log(exception: unknown, status: number, req: Request & { user?: any; requiredPermissions?: string[] }, message: unknown) {
    const userId: string | undefined = req.user?.userId ?? req.user?.id;
    const path = req.originalUrl ?? req.url;
    const ip = req.ip ?? req.socket?.remoteAddress;
    const base = { method: req.method, path, statusCode: status, userId, ip };
    const text = Array.isArray(message) ? message.join('; ') : String(message ?? '');

    const isLogin = /\/auth\/login(\?|$)/.test(path);
    if (isLogin && (status === HttpStatus.UNAUTHORIZED || status === HttpStatus.TOO_MANY_REQUESTS)) {
      this.logger.event('warn', 'Authentication failure', {
        ...base,
        attemptedEmail: (req.body as any)?.email,
        reason: text,
      });
      return;
    }

    if (status === HttpStatus.FORBIDDEN) {
      this.logger.event('warn', 'Permission denied', {
        ...base,
        role: req.user?.role,
        resource: `${req.method} ${path}`,
        requiredPermission: req.requiredPermissions,
        reason: text,
      });
      return;
    }

    if (status >= 500) {
      const err = exception instanceof Error ? exception : new Error(String(exception));
      this.logger.event('error', err.message || text, { ...base, stack: err.stack });
      return;
    }

    if (status === HttpStatus.TOO_MANY_REQUESTS) {
      this.logger.event('warn', 'Rate limit exceeded', base);
    }
    // Other 4xx are client errors: the request log line already records them.
  }
}

/** 429 -> "Too Many Requests" (matches Nest's default `error` wording). */
function statusLabel(status: number): string {
  const name = HttpStatus[status];
  if (!name) return 'Error';
  return name
    .toLowerCase()
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}
