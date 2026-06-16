import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createGetRequest, createJsonRequest, readJson } from '../helpers.js';

const mocks = vi.hoisted(() => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
  },
  getCurrentUser: vi.fn(),
  signJWT: vi.fn(),
}));

vi.mock('@/lib/db', () => ({ default: mocks.prisma }));
vi.mock('@/lib/auth', () => ({
  getCurrentUser: mocks.getCurrentUser,
  signJWT: mocks.signJWT,
}));

const { GET, POST } = await import('@/app/api/auth/route.js');

describe('/api/auth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns authenticated user details from the database', async () => {
    mocks.getCurrentUser.mockResolvedValue({ userId: 'user-1' });
    mocks.prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
      balance: 100,
    });

    const response = await GET(createGetRequest('http://localhost/api/auth'));

    expect(response.status).toBe(200);
    await expect(readJson(response)).resolves.toEqual({
      authenticated: true,
      user: { id: 'user-1', email: 'user@example.com', balance: 100 },
    });
  });

  it('returns 401 when there is no authenticated user', async () => {
    mocks.getCurrentUser.mockResolvedValue(null);

    const response = await GET(createGetRequest('http://localhost/api/auth'));

    expect(response.status).toBe(401);
    await expect(readJson(response)).resolves.toEqual({ authenticated: false });
  });

  it('supports developer login and sets a session cookie', async () => {
    mocks.prisma.user.upsert.mockResolvedValue({
      id: 'admin-1',
      email: 'admin@kaizen.com',
      name: 'Admin',
      role: 'admin',
    });
    mocks.signJWT.mockResolvedValue('signed-token');

    const response = await POST(createJsonRequest('http://localhost/api/auth', {
      action: 'developer_login',
      role: 'admin',
    }));
    const body = await readJson(response);

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ success: true });
    expect(response.headers.get('set-cookie')).toContain('session-token=signed-token');
  });

  it('clears the session cookie on logout', async () => {
    const response = await POST(createJsonRequest('http://localhost/api/auth', {
      action: 'logout',
    }));

    expect(response.status).toBe(200);
    expect(response.headers.get('set-cookie')).toContain('session-token=');
  });
});
