import { Controller, Get, INestApplication, Post } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import request from 'supertest';
import { AppThrottlerGuard } from './app-throttler.guard';
import { buildThrottlers } from './throttler.config';

@Controller()
class TestController {
  @Get('ping')
  ping() {
    return { ok: true };
  }

  @Post('auth/login')
  login() {
    return { ok: true };
  }
}

async function makeApp(env: Record<string, string>): Promise<{ app: INestApplication; jwt: JwtService }> {
  const moduleRef = await Test.createTestingModule({
    imports: [
      JwtModule.register({ secret: 'test-secret' }),
      ThrottlerModule.forRoot(buildThrottlers(env as NodeJS.ProcessEnv)),
    ],
    controllers: [TestController],
    providers: [{ provide: APP_GUARD, useClass: AppThrottlerGuard }],
  }).compile();
  const app = moduleRef.createNestApplication();
  await app.init();
  return { app, jwt: moduleRef.get(JwtService) };
}

describe('API rate limiting (Task 61, R38)', () => {
  let app: INestApplication;

  afterEach(async () => {
    await app?.close();
  });

  it('limits login attempts per IP and returns 429 with Retry-After (R38.4, R38.5)', async () => {
    ({ app } = await makeApp({ LOGIN_RATE_LIMIT: '2' }));
    const server = app.getHttpServer();

    await request(server).post('/auth/login').expect(201);
    await request(server).post('/auth/login').expect(201);
    const blocked = await request(server).post('/auth/login').expect(429);

    const retryAfter = Number(blocked.headers['retry-after']);
    expect(retryAfter).toBeGreaterThan(0);
    expect(retryAfter).toBeLessThanOrEqual(15 * 60);
  });

  it('does not apply the login limit to other routes', async () => {
    ({ app } = await makeApp({ LOGIN_RATE_LIMIT: '1' }));
    const server = app.getHttpServer();
    for (let i = 0; i < 5; i++) {
      await request(server).get('/ping').expect(200);
    }
  });

  it('limits each authenticated user separately (R38.1)', async () => {
    let jwt: JwtService;
    ({ app, jwt } = await makeApp({ USER_RATE_LIMIT: '2', IP_RATE_LIMIT: '100' }));
    const server = app.getHttpServer();
    const alice = `Bearer ${jwt.sign({ sub: 'alice' })}`;
    const bob = `Bearer ${jwt.sign({ sub: 'bob' })}`;

    await request(server).get('/ping').set('Authorization', alice).expect(200);
    await request(server).get('/ping').set('Authorization', alice).expect(200);
    await request(server).get('/ping').set('Authorization', alice).expect(429);

    // Same IP, different user: still allowed
    await request(server).get('/ping').set('Authorization', bob).expect(200);
  });

  it('a forged token cannot spend another user\'s quota', async () => {
    let jwt: JwtService;
    ({ app, jwt } = await makeApp({ USER_RATE_LIMIT: '1', IP_RATE_LIMIT: '100' }));
    const server = app.getHttpServer();
    const forged = `Bearer ${new JwtService({ secret: 'wrong' }).sign({ sub: 'alice' })}`;
    const real = `Bearer ${jwt.sign({ sub: 'alice' })}`;

    // Forged token is bucketed by IP, not as "alice"
    await request(server).get('/ping').set('Authorization', forged).expect(200);
    await request(server).get('/ping').set('Authorization', real).expect(200);
  });

  it('enforces the per-IP limit (R38.2)', async () => {
    ({ app } = await makeApp({ IP_RATE_LIMIT: '3', USER_RATE_LIMIT: '100' }));
    const server = app.getHttpServer();
    for (let i = 0; i < 3; i++) await request(server).get('/ping').expect(200);
    await request(server).get('/ping').expect(429);
  });
});
