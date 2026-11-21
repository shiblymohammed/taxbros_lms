import * as winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { maskSensitive } from './mask';

/**
 * Winston configuration (Requirement R39)
 *
 * - Structured JSON lines in files
 * - logs/combined-YYYY-MM-DD.log (all levels) and logs/error-YYYY-MM-DD.log (errors only)
 * - Daily rotation, 90-day retention, gzip of rotated files
 * - Every entry passes through the masking format before it is written
 */

/** Redact secrets from the message and all metadata. */
const redact = winston.format((info) => {
  const masked = maskSensitive({ ...info }) as Record<string, unknown>;
  for (const key of Object.keys(masked)) {
    (info as Record<string, unknown>)[key] = masked[key];
  }
  return info;
});

export interface LoggerOptions {
  logDir?: string;
  level?: string;
  /** Pretty console output (development). Files are always JSON. */
  prettyConsole?: boolean;
  /** Disable file transports (tests). */
  disableFiles?: boolean;
}

export function createWinstonLogger(opts: LoggerOptions = {}): winston.Logger {
  const logDir = opts.logDir ?? process.env.LOG_DIR ?? 'logs';
  const level = opts.level ?? process.env.LOG_LEVEL ?? 'info';
  const pretty = opts.prettyConsole ?? process.env.NODE_ENV !== 'production';

  const jsonFormat = winston.format.combine(
    redact(),
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json(),
  );

  const consoleFormat = pretty
    ? winston.format.combine(
        redact(),
        winston.format.timestamp({ format: 'HH:mm:ss' }),
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level: lvl, message, context, ...meta }) => {
          const ctx = context ? `[${String(context)}] ` : '';
          const rest = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
          return `${String(timestamp)} ${lvl} ${ctx}${String(message)}${rest}`;
        }),
      )
    : jsonFormat;

  const transports: winston.transport[] = [new winston.transports.Console({ format: consoleFormat })];

  if (!opts.disableFiles && process.env.LOG_TO_FILES !== 'false') {
    const common = {
      dirname: logDir,
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxFiles: process.env.LOG_RETENTION ?? '90d',
      format: jsonFormat,
    };
    transports.push(
      new DailyRotateFile({ ...common, filename: 'combined-%DATE%.log', level }),
      new DailyRotateFile({ ...common, filename: 'error-%DATE%.log', level: 'error' }),
    );
  }

  return winston.createLogger({ level, transports, exitOnError: false });
}
