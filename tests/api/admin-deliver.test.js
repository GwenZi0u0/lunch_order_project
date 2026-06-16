import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createJsonRequest, readJson } from '../helpers.js';

const mocks = vi.hoisted(() => ({
  prisma: {
    weeklySchedule: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    user: {
      update: vi.fn(),
    },
    balanceTransaction: {
      create: vi.fn(),
    },
    order: {
      update: vi.fn(),
    },
    $transaction: vi.fn(),
  },
  getCurrentUser: vi.fn(),
}));

vi.mock('@/lib/db', () => ({ default: mocks.prisma }));
vi.mock('@/lib/auth', () => ({ getCurrentUser: mocks.getCurrentUser }));

const { POST } = await import('@/app/api/admin/deliver/route.js');

describe('/api/admin/deliver', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.prisma.$transaction.mockImplementation(async (callback) => callback(mocks.prisma));
  });

  it('rejects non-admin users', async () => {
    mocks.getCurrentUser.mockResolvedValue({ userId: 'user-1', role: 'user' });

    const response = await POST(createJsonRequest('http://localhost/api/admin/deliver', {
      scheduleId: 'sched-1',
    }));

    expect(response.status).toBe(403);
  });

  it('deducts balances, records charge transactions, and marks the schedule delivered', async () => {
    mocks.getCurrentUser.mockResolvedValue({ userId: 'admin-1', role: 'admin' });
    mocks.prisma.weeklySchedule.findUnique.mockResolvedValue({
      id: 'sched-1',
      deliveredAt: null,
      orders: [
        { id: 'order-1', userId: 'user-1', totalAmount: 120 },
        { id: 'order-2', userId: 'user-2', totalAmount: 80 },
      ],
    });

    const response = await POST(createJsonRequest('http://localhost/api/admin/deliver', {
      scheduleId: 'sched-1',
    }));

    expect(response.status).toBe(200);
    expect(mocks.prisma.user.update).toHaveBeenCalledTimes(2);
    expect(mocks.prisma.balanceTransaction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-1',
        type: 'charge',
        amount: -120,
        orderId: 'order-1',
        operatedBy: 'admin-1',
      }),
    });
    expect(mocks.prisma.order.update).toHaveBeenCalledWith({
      where: { id: 'order-1' },
      data: expect.objectContaining({ status: 'delivered' }),
    });
    expect(mocks.prisma.weeklySchedule.update).toHaveBeenCalledWith({
      where: { id: 'sched-1' },
      data: { deliveredAt: expect.any(Date) },
    });
    await expect(readJson(response)).resolves.toMatchObject({ success: true });
  });

  it('does not bill a schedule twice', async () => {
    mocks.getCurrentUser.mockResolvedValue({ userId: 'admin-1', role: 'admin' });
    mocks.prisma.weeklySchedule.findUnique.mockResolvedValue({
      id: 'sched-1',
      deliveredAt: new Date(),
      orders: [],
    });

    const response = await POST(createJsonRequest('http://localhost/api/admin/deliver', {
      scheduleId: 'sched-1',
    }));

    expect(response.status).toBe(400);
  });
});
