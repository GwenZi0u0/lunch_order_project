import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createGetRequest, createJsonRequest, readJson } from '../helpers.js';

const mocks = vi.hoisted(() => ({
  prisma: {
    siteSetting: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
  },
  getCurrentUser: vi.fn(),
}));

vi.mock('@/lib/db', () => ({ default: mocks.prisma }));
vi.mock('@/lib/auth', () => ({ getCurrentUser: mocks.getCurrentUser }));

const announcementsRoute = await import('@/app/api/announcement/route.js');
const notificationsRoute = await import('@/app/api/notifications/route.js');

describe('/api/announcement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns default announcements when settings are empty', async () => {
    mocks.getCurrentUser.mockResolvedValue({ userId: 'user-1', role: 'user' });
    mocks.prisma.siteSetting.findMany.mockResolvedValue([]);

    const response = await announcementsRoute.GET(createGetRequest('http://localhost/api/announcement'));
    const body = await readJson(response);

    expect(response.status).toBe(200);
    expect(body.announcements).toHaveLength(2);
  });

  it('lets admins save normalized and pinned announcements', async () => {
    mocks.getCurrentUser.mockResolvedValue({ userId: 'admin-1', role: 'admin' });
    mocks.prisma.siteSetting.upsert.mockResolvedValue({
      value: JSON.stringify([
        { id: 'a2', title: 'Pinned', content: 'Important', pinned: true, updatedAt: '2026-06-16T00:00:00.000Z' },
        { id: 'a1', title: 'Normal', content: 'Info', pinned: false, updatedAt: '2026-06-16T00:00:00.000Z' },
      ]),
    });

    const response = await announcementsRoute.PUT(createJsonRequest('http://localhost/api/announcement', {
      announcements: [
        { id: 'a1', title: ' Normal ', content: ' Info ', pinned: false },
        { id: 'a2', title: ' Pinned ', content: ' Important ', pinned: true },
      ],
    }, { method: 'PUT' }));
    const body = await readJson(response);

    expect(response.status).toBe(200);
    expect(mocks.prisma.siteSetting.upsert).toHaveBeenCalled();
    expect(body.announcements[0]).toMatchObject({ id: 'a2', pinned: true });
  });
});

describe('/api/notifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when no broadcast notification exists', async () => {
    mocks.getCurrentUser.mockResolvedValue({ userId: 'user-1', role: 'user' });
    mocks.prisma.siteSetting.findUnique.mockResolvedValue(null);

    const response = await notificationsRoute.GET(createGetRequest('http://localhost/api/notifications'));

    expect(response.status).toBe(200);
    await expect(readJson(response)).resolves.toEqual({ notification: null });
  });

  it('lets admins publish a broadcast notification', async () => {
    mocks.getCurrentUser.mockResolvedValue({ userId: 'admin-1', role: 'admin' });
    mocks.prisma.siteSetting.upsert.mockResolvedValue({});

    const response = await notificationsRoute.POST(createJsonRequest('http://localhost/api/notifications', {
      title: 'Lunch',
      message: 'Orders are closing soon',
    }));
    const body = await readJson(response);

    expect(response.status).toBe(200);
    expect(body.notification).toMatchObject({
      title: 'Lunch',
      message: 'Orders are closing soon',
      createdBy: 'admin-1',
    });
    expect(mocks.prisma.siteSetting.upsert).toHaveBeenCalled();
  });

  it('requires a notification message', async () => {
    mocks.getCurrentUser.mockResolvedValue({ userId: 'admin-1', role: 'admin' });

    const response = await notificationsRoute.POST(createJsonRequest('http://localhost/api/notifications', {
      message: '   ',
    }));

    expect(response.status).toBe(400);
  });
});
