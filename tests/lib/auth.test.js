import { describe, expect, it } from 'vitest';
import { getCurrentUser, signJWT, verifyJWT } from '@/lib/auth';

describe('auth helpers', () => {
  it('signs and verifies a JWT payload', async () => {
    const token = await signJWT({
      userId: 'user-1',
      email: 'user@example.com',
      role: 'admin',
    });

    const payload = await verifyJWT(token);

    expect(payload).toMatchObject({
      userId: 'user-1',
      email: 'user@example.com',
      role: 'admin',
    });
  });

  it('returns null for invalid JWTs', async () => {
    await expect(verifyJWT('not-a-valid-token')).resolves.toBeNull();
  });

  it('reads the current user from a session cookie', async () => {
    const token = await signJWT({ userId: 'cookie-user', role: 'user' });
    const request = {
      cookies: {
        get: () => ({ value: token }),
      },
      headers: new Headers(),
    };

    await expect(getCurrentUser(request)).resolves.toMatchObject({
      userId: 'cookie-user',
      role: 'user',
    });
  });

  it('falls back to a bearer token header', async () => {
    const token = await signJWT({ userId: 'bearer-user', role: 'user' });
    const request = {
      headers: new Headers({ authorization: `Bearer ${token}` }),
    };

    await expect(getCurrentUser(request)).resolves.toMatchObject({
      userId: 'bearer-user',
      role: 'user',
    });
  });
});
