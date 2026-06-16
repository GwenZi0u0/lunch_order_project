import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createGetRequest, createJsonRequest, readJson } from '../helpers.js';

const mocks = vi.hoisted(() => ({
  prisma: {
    user: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    balanceTransaction: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
  getCurrentUser: vi.fn(),
}));

vi.mock('@/lib/db', () => ({ default: mocks.prisma }));
vi.mock('@/lib/auth', () => ({ getCurrentUser: mocks.getCurrentUser }));

const { GET, POST, PATCH } = await import('@/app/api/wallets/route.js');

describe('/api/wallets', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.prisma.$transaction.mockImplementation(async (callback) => callback(mocks.prisma));
  });

  it('lets admins list users', async () => {
    mocks.getCurrentUser.mockResolvedValue({ userId: 'admin-1', role: 'admin' });
    mocks.prisma.user.findMany.mockResolvedValue([{ id: 'user-1', name: 'User' }]);

    const response = await GET(createGetRequest('http://localhost/api/wallets?action=list_users'));

    expect(response.status).toBe(200);
    expect(mocks.prisma.user.findMany).toHaveBeenCalledWith({ orderBy: { name: 'asc' } });
  });

  it('prevents normal users from reading another user wallet history', async () => {
    mocks.getCurrentUser.mockResolvedValue({ userId: 'user-1', role: 'user' });

    const response = await GET(createGetRequest('http://localhost/api/wallets?action=history&userId=user-2'));

    expect(response.status).toBe(403);
  });

  it('applies Taipei date filters to wallet history', async () => {
    mocks.getCurrentUser.mockResolvedValue({ userId: 'admin-1', role: 'admin' });
    mocks.prisma.balanceTransaction.findMany.mockResolvedValue([]);

    const response = await GET(createGetRequest('http://localhost/api/wallets?action=history&startDate=2026-06-01&endDate=2026-06-02'));

    expect(response.status).toBe(200);
    expect(mocks.prisma.balanceTransaction.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        createdAt: {
          gte: new Date('2026-06-01T00:00:00+08:00'),
          lt: new Date('2026-06-03T00:00:00+08:00'),
        },
      },
    }));
  });

  it('rejects invalid wallet date filters', async () => {
    mocks.getCurrentUser.mockResolvedValue({ userId: 'admin-1', role: 'admin' });

    const response = await GET(createGetRequest('http://localhost/api/wallets?action=history&startDate=not-a-date'));

    expect(response.status).toBe(400);
    await expect(readJson(response)).resolves.toEqual({ error: 'Invalid date filter' });
  });

  it('lets admins top up a wallet and records a ledger transaction', async () => {
    mocks.getCurrentUser.mockResolvedValue({ userId: 'admin-1', role: 'admin' });
    mocks.prisma.user.findUnique.mockResolvedValue({ id: 'user-1', balance: 100 });
    mocks.prisma.user.update.mockResolvedValue({ id: 'user-1', balance: 600 });

    const response = await POST(createJsonRequest('http://localhost/api/wallets', {
      targetUserId: 'user-1',
      type: 'topup',
      amount: '500',
      source: '現金',
      note: 'paid',
    }));

    expect(response.status).toBe(200);
    expect(mocks.prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { balance: { increment: 500 } },
    });
    expect(mocks.prisma.balanceTransaction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-1',
        type: 'topup',
        amount: 500,
        source: '現金',
        operatedBy: 'admin-1',
      }),
    });
    await expect(readJson(response)).resolves.toEqual({ success: true, balance: 600 });
  });

  it('prevents an admin from removing their own admin role', async () => {
    mocks.getCurrentUser.mockResolvedValue({ userId: 'admin-1', role: 'admin' });

    const response = await PATCH(createJsonRequest('http://localhost/api/wallets', {
      targetUserId: 'admin-1',
      role: 'user',
    }, { method: 'PATCH' }));

    expect(response.status).toBe(400);
  });
});
