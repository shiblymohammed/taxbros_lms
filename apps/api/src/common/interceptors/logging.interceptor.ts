import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable, tap } from 'rxjs';
import { AppLogger } from '../logging/app-logger.service';

/**
 * Request/response logging (Task 60, Requirement R39)
 *
 * One structured line per request: method, path, status, duration, userId.
 * Bodies are not logged (they may hold passwords or personal data); failed
 * requests are logged in detail by HttpExceptionFilter instead.
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(private readonly logger: AppLogger) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();

    const http = context.switchToHttp();
    const req = http.getRequest<Request & { user?: any }>();
    const res = http.getResponse<Response>();
    const started = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          this.logger.event('info', 'HTTP request', {
            method: req.method,
            path: req.originalUrl ?? req.url,
            statusCode: res.statusCode,
            durationMs: Date.now() - started,
            userId: req.user?.userId ?? req.user?.id,
          });
        },
        error: (err: any) => {
          this.logger.event('info', 'HTTP request', {
            method: req.method,
            path: req.originalUrl ?? req.url,
            statusCode: typeof err?.getStatus === 'function' ? err.getStatus() : 500,
            durationMs: Date.now() - started,
            userId: req.user?.userId ?? req.user?.id,
          });
        },
      }),
    );
  }
}
