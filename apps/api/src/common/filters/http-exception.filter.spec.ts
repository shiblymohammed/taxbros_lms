import {
  ArgumentsHost,
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter';
import { AppLogger } from '../logging/app-logger.service';

function makeHost(req: Record<string, any>) {
  const res: any = {
    headersSent: false,
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  const host = {
    switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }),
  } as unknown as ArgumentsHost;
  return { host, res };
}

describe('HttpExceptionFilter (Task 60)', () => {
  let logger: { event: jest.Mock };
  let filter: HttpExceptionFilter;

  beforeEach(() => {
    logger = { event: jest.fn() };
    filter = new HttpExceptionFilter(logger as unknown as AppLogger);
  });

  it('preserves Nest error fields and adds path/timestamp', () => {
    const { host, res } = makeHost({ method: 'POST', url: '/api/labs/X/submit', originalUrl: '/api/labs/X/submit' });
    filter.catch(
      new BadRequestException({ message: 'Form validation failed', errors: [{ field: 'PAN', message: 'bad' }] }),
      host,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    const body = res.json.mock.calls[0][0];
    expect(body).toMatchObject({
      statusCode: 400,
      message: 'Form validation failed',
      errors: [{ field: 'PAN', message: 'bad' }],
      path: '/api/labs/X/submit',
    });
    expect(typeof body.timestamp).toBe('string');
    expect(logger.event).not.toHaveBeenCalled(); // ordinary 4xx is not an error log
  });

  it('hides internals of unexpected errors and logs them at ERROR with user and path', () => {
    const { host, res } = makeHost({
      method: 'GET',
      originalUrl: '/api/courses',
      user: { userId: 'u-1' },
    });
    filter.catch(new Error('connect ECONNREFUSED 127.0.0.1:5432'), host);

    expect(res.status).toHaveBeenCalledWith(500);
    const body = res.json.mock.calls[0][0];
    expect(body.message).not.toContain('ECONNREFUSED');
    expect(logger.event).toHaveBeenCalledWith(
      'error',
      'connect ECONNREFUSED 127.0.0.1:5432',
      expect.objectContaining({ userId: 'u-1', path: '/api/courses', stack: expect.any(String) }),
    );
  });

  it('logs failed logins at WARN with attempted email and IP (R39.2)', () => {
    const { host } = makeHost({
      method: 'POST',
      originalUrl: '/api/auth/login',
      ip: '10.0.0.5',
      body: { email: 'who@example.com', password: 'nope' },
    });
    filter.catch(new UnauthorizedException('Invalid email or password'), host);

    expect(logger.event).toHaveBeenCalledWith(
      'warn',
      'Authentication failure',
      expect.objectContaining({ attemptedEmail: 'who@example.com', ip: '10.0.0.5' }),
    );
    // The password must never be passed to the logger
    expect(JSON.stringify(logger.event.mock.calls)).not.toContain('nope');
  });

  it('logs permission denials at WARN with user, resource and required permission (R39.3)', () => {
    const { host } = makeHost({
      method: 'POST',
      originalUrl: '/api/attendance/student/registers',
      user: { userId: 'staff-user', role: 'STAFF' },
      requiredPermissions: ['MARK_ATTENDANCE'],
    });
    filter.catch(new ForbiddenException('Missing permission'), host);

    expect(logger.event).toHaveBeenCalledWith(
      'warn',
      'Permission denied',
      expect.objectContaining({
        userId: 'staff-user',
        resource: 'POST /api/attendance/student/registers',
        requiredPermission: ['MARK_ATTENDANCE'],
      }),
    );
  });

  it('logs rate-limit hits at WARN', () => {
    const { host, res } = makeHost({ method: 'GET', originalUrl: '/api/labs' });
    filter.catch(new HttpException('Too many requests', HttpStatus.TOO_MANY_REQUESTS), host);
    expect(res.status).toHaveBeenCalledWith(429);
    expect(logger.event).toHaveBeenCalledWith('warn', 'Rate limit exceeded', expect.any(Object));
  });
});
