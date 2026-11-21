import { Injectable, LoggerService } from '@nestjs/common';
import type { Logger as WinstonLogger } from 'winston';
import { createWinstonLogger } from './winston.config';

type Level = 'error' | 'warn' | 'info' | 'debug' | 'verbose';

/**
 * Nest LoggerService backed by Winston.
 *
 * Registered with `app.useLogger()` so framework logs and every
 * `new Logger(Context)` in the codebase go through the same masked JSON pipeline.
 */
@Injectable()
export class AppLogger implements LoggerService {
  private static shared?: WinstonLogger;
  private readonly logger: WinstonLogger;

  constructor() {
    AppLogger.shared ??= createWinstonLogger({
      disableFiles: process.env.NODE_ENV === 'test',
    });
    this.logger = AppLogger.shared;
  }

  log(message: unknown, ...optional: unknown[]) {
    this.write('info', message, optional);
  }

  error(message: unknown, ...optional: unknown[]) {
    this.write('error', message, optional);
  }

  warn(message: unknown, ...optional: unknown[]) {
    this.write('warn', message, optional);
  }

  debug(message: unknown, ...optional: unknown[]) {
    this.write('debug', message, optional);
  }

  verbose(message: unknown, ...optional: unknown[]) {
    this.write('verbose', message, optional);
  }

  /** Structured log with explicit metadata, e.g. `logger.event('warn', 'Permission denied', {...})`. */
  event(level: Exclude<Level, 'verbose'>, message: string, meta: Record<string, unknown> = {}) {
    this.logger.log(level, message, meta);
  }

  /**
   * Nest calls: log(msg, context) and error(msg, stack, context).
   * Normalise those positional args into Winston metadata.
   */
  private write(level: Level, message: unknown, optional: unknown[]) {
    const args = [...optional];
    const meta: Record<string, unknown> = {};

    if (typeof args[args.length - 1] === 'string') {
      meta.context = args.pop();
    }
    if (level === 'error' && typeof args[0] === 'string') {
      meta.stack = args.shift();
    }
    for (const extra of args) {
      if (extra && typeof extra === 'object') Object.assign(meta, extra);
    }

    if (message instanceof Error) {
      meta.stack ??= message.stack;
      this.logger.log(level, message.message, meta);
    } else if (typeof message === 'object' && message !== null) {
      this.logger.log(level, 'log', { ...meta, ...(message as object) });
    } else {
      this.logger.log(level, String(message), meta);
    }
  }
}
