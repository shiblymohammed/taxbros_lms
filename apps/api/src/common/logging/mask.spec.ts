import { MASK, maskSensitive, maskString } from './mask';

describe('log masking (R39.4)', () => {
  it('redacts password, token and secret fields at any depth', () => {
    const input = {
      email: 'a@example.com',
      password: 'Secret#123',
      nested: { refreshToken: 'abc', accessToken: 'def', jwtSecret: 'x', keep: 1 },
      headers: { authorization: 'Bearer abc.def.ghi', cookie: 'refreshToken=zzz' },
      list: [{ newPassword: 'p' }],
    };

    const out = maskSensitive(input);

    expect(out.email).toBe('a@example.com');
    expect(out.password).toBe(MASK);
    expect(out.nested.refreshToken).toBe(MASK);
    expect(out.nested.accessToken).toBe(MASK);
    expect(out.nested.jwtSecret).toBe(MASK);
    expect(out.nested.keep).toBe(1);
    expect(out.headers.authorization).toBe(MASK);
    expect(out.headers.cookie).toBe(MASK);
    expect(out.list[0].newPassword).toBe(MASK);
  });

  it('does not mutate the original object', () => {
    const input = { password: 'x' };
    maskSensitive(input);
    expect(input.password).toBe('x');
  });

  it('redacts bearer tokens and JWTs inside free text', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.c2lnbmF0dXJl';
    expect(maskString(`Authorization: Bearer ${jwt}`)).not.toContain(jwt);
    expect(maskString(`token was ${jwt} end`)).toBe(`token was ${MASK} end`);
  });

  it('handles circular references', () => {
    const a: any = { name: 'a' };
    a.self = a;
    expect(() => maskSensitive(a)).not.toThrow();
    expect(maskSensitive(a).self).toBe('[Circular]');
  });
});
