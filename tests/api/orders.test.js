import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createGetRequest, createJsonRequest, readJson } from '../helpers.js';

const mocks = vi.hoisted(() => ({
  prisma: {
    order: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
      create: vi.fn(),
    },
    weeklySchedule: {
      findUnique: vi.fn(),
    },
    menuItem: {
      findMany: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(),
  },
  getCurrentUser: vi.fn(),
}));

vi.mock('@/lib/db', () => ({ default: mocks.prisma }));
vi.mock('@/lib/auth', () => ({ getCurrentUser: mocks.getCurrentUser }));

const { GET, POST, DELETE } = await import('@/app/api/orders/route.js');

describe('/api/orders', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.prisma.$transaction.mockImplementation(async (callback) => callback(mocks.prisma));
  });

  it('lists all non-cancelled schedule orders for admins', async () => {
    mocks.getCurrentUser.mockResolvedValue({ userId: 'admin-1', role: 'admin' });
    mocks.prisma.order.findMany.mockResolvedValue([{ id: 'order-1' }]);

    const response = await GET(createGetRequest('http://localhost/api/orders?scheduleId=sched-1'));

    expect(response.status).toBe(200);
    expect(mocks.prisma.order.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { status: { not: 'cancelled' }, scheduleId: 'sched-1' },
    }));
    await expect(readJson(response)).resolves.toEqual([{ id: 'order-1' }]);
  });

  it('lists only the current user orders for normal users', async () => {
    mocks.getCurrentUser.mockResolvedValue({ userId: 'user-1', role: 'user' });
    mocks.prisma.order.findMany.mockResolvedValue([]);

    await GET(createGetRequest('http://localhost/api/orders'));

    expect(mocks.prisma.order.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: 'user-1' },
    }));
  });

  it('creates an order and replaces any existing active order for the same schedule', async () => {
    mocks.getCurrentUser.mockResolvedValue({ userId: 'user-1', role: 'user' });
    mocks.prisma.weeklySchedule.findUnique.mockResolvedValue({
      id: 'sched-1',
      date: '2999-01-01',
      restaurantId: 'rest-1',
      orderDeadline: '09:40',
      isOpen: true,
      deliveredAt: null,
    });
    mocks.prisma.menuItem.findMany.mockResolvedValue([
      { id: 'menu-1', price: 90 },
      { id: 'menu-2', price: 30 },
    ]);
    mocks.prisma.order.findFirst.mockResolvedValue({ id: 'old-order' });
    mocks.prisma.order.create.mockResolvedValue({
      id: 'new-order',
      totalAmount: 210,
      orderItems: [],
    });

    const response = await POST(createJsonRequest('http://localhost/api/orders', {
      scheduleId: 'sched-1',
      items: [
        { menuItemId: 'menu-1', quantity: 2 },
        { menuItemId: 'menu-2', quantity: 1 },
      ],
      note: 'no onion',
    }));

    expect(response.status).toBe(200);
    expect(mocks.prisma.order.delete).toHaveBeenCalledWith({ where: { id: 'old-order' } });
    expect(mocks.prisma.order.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        userId: 'user-1',
        scheduleId: 'sched-1',
        totalAmount: 210,
        note: 'no onion',
      }),
    }));
  });

  it('blocks normal users from ordering after a past deadline', async () => {
    mocks.getCurrentUser.mockResolvedValue({ userId: 'user-1', role: 'user' });
    mocks.prisma.weeklySchedule.findUnique.mockResolvedValue({
      id: 'sched-1',
      date: '2000-01-01',
      restaurantId: 'rest-1',
      orderDeadline: '09:40',
      isOpen: true,
      deliveredAt: null,
    });

    const response = await POST(createJsonRequest('http://localhost/api/orders', {
      scheduleId: 'sched-1',
      items: [{ menuItemId: 'menu-1', quantity: 1 }],
    }));

    expect(response.status).toBe(400);
    expect((await readJson(response)).error).toContain('Ordering is closed');
  });

  it('allows admin override orders for a target user', async () => {
    mocks.getCurrentUser.mockResolvedValue({ userId: 'admin-1', role: 'admin' });
    mocks.prisma.user.findUnique.mockResolvedValue({ id: 'user-2' });
    mocks.prisma.weeklySchedule.findUnique.mockResolvedValue({
      id: 'sched-1',
      date: '2000-01-01',
      restaurantId: 'rest-1',
      orderDeadline: '09:40',
      isOpen: true,
      deliveredAt: null,
    });
    mocks.prisma.menuItem.findMany.mockResolvedValue([{ id: 'menu-1', price: 100 }]);
    mocks.prisma.order.findFirst.mockResolvedValue(null);
    mocks.prisma.order.create.mockResolvedValue({ id: 'order-1', totalAmount: 100, orderItems: [] });

    const response = await POST(createJsonRequest('http://localhost/api/orders', {
      scheduleId: 'sched-1',
      targetUserId: 'user-2',
      items: [{ menuItemId: 'menu-1', quantity: 1 }],
    }));

    expect(response.status).toBe(200);
    expect(mocks.prisma.order.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ userId: 'user-2' }),
    }));
  });

  it('forbids users from deleting someone else order', async () => {
    mocks.getCurrentUser.mockResolvedValue({ userId: 'user-1', role: 'user' });
    mocks.prisma.order.findUnique.mockResolvedValue({
      id: 'order-1',
      userId: 'user-2',
      schedule: { deliveredAt: null, date: '2999-01-01', orderDeadline: '09:40' },
    });

    const response = await DELETE(createGetRequest('http://localhost/api/orders?orderId=order-1'));

    expect(response.status).toBe(403);
  });
});
