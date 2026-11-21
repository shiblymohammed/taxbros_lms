import { Controller, Get, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import helmet from 'helmet';
import request from 'supertest';
import {
  assertProductionSecrets,
  buildHelmetOptions,
  isSwaggerEnabled,
  parseCorsOrigins,
} from './security.config';

describe('parseCorsOrigins (Task 70)', () => {
  it('splits a comma-separated list and trims trailing slashes', () => {
    expect(parseCorsOrigins('https://a.example/, https://b.example', 'production')).toEqual([
      'https://a.example',
      'https://b.example',
    ]);
  });

  it('defaults to the local web app in development', () => {
    expect(parseCorsOrigins(undefined, 'development')).toEqual(['http://localhost:3000']);
  });

  it('refuses unsafe production settings', () => {
    expect(() => parseCorsOrigins(undefined, 'production')).toThrow(/must be set/);
    expect(() => parseCorsOrigins('*', 'production')).toThrow(/cannot be "\*"/);
    expect(() => parseCorsOrigins('http://lms.example', 'production')).toThrow(/https/);
  });
});

describe('assertProductionSecrets (Task 68)', () => {
  const strong = 'a'.repeat(20) + 'Q9x' + 'b'.repeat(20);
  const strong2 = 'c'.repeat(20) + 'Z7y' + 'd'.repeat(20);

  it('ignores development', () => {
    expect(() => assertProductionSecrets({ NODE_ENV: 'development' })).not.toThrow();
  });

  it('rejects missing, short, example and identical secrets in production', () => {
    expect(() => assertProductionSecrets({ NODE_ENV: 'production' })).toThrow(/JWT_SECRET is not set/);
    expect(() =>
      assertProductionSecrets({ NODE_ENV: 'production', JWT_SECRET: 'short', JWT_REFRESH_SECRET: strong }),
    ).toThrow(/at least 32/);
    expect(() =>
      assertProductionSecrets({
        NODE_ENV: 'production',
        JWT_SECRET: 'your-super-secret-jwt-key-change-in-production-minimum-256-bits',
        JWT_REFRESH_SECRET: strong,
      }),
    ).toThrow(/example value/);
    expect(() =>
      assertProductionSecrets({ NODE_ENV: 'production', JWT_SECRET: strong, JWT_REFRESH_SECRET: strong }),
    ).toThrow(/different/);
  });

  it('accepts strong distinct secrets', () => {
    expect(() =>
      assertProductionSecrets({ NODE_ENV: 'production', JWT_SECRET: strong, JWT_REFRESH_SECRET: strong2 }),
    ).not.toThrow();
  });
});

describe('isSwaggerEnabled', () => {
  it('is on in development and off in production unless forced', () => {
    expect(isSwaggerEnabled(undefined, 'development')).toBe(true);
    expect(isSwaggerEnabled(undefined, 'production')).toBe(false);
    expect(isSwaggerEnabled('true', 'production')).toBe(true);
    expect(isSwaggerEnabled('false', 'development')).toBe(false);
  });
});

@Controller()
class PingController {
  @Get('ping')
  ping() {
    return { ok: true };
  }
}

describe('API security headers (Task 70)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ controllers: [PingController] }).compile();
    app = moduleRef.createNestApplication();
    app.use(helmet(buildHelmetOptions()));
    app.enableCors({ origin: ['https://lms.example'], credentials: true });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('sends HSTS for one year, nosniff, CSP and frame protection', async () => {
    const res = await request(app.getHttpServer()).get('/ping').expect(200);
    expect(res.headers['strict-transport-security']).toBe('max-age=31536000; includeSubDomains');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
  });

  it('allows credentials only for the configured origin', async () => {
    const allowed = await request(app.getHttpServer()).get('/ping').set('Origin', 'https://lms.example');
    expect(allowed.headers['access-control-allow-origin']).toBe('https://lms.example');
    expect(allowed.headers['access-control-allow-credentials']).toBe('true');

    const other = await request(app.getHttpServer()).get('/ping').set('Origin', 'https://evil.example');
    expect(other.headers['access-control-allow-origin']).toBeUndefined();
  });
});
