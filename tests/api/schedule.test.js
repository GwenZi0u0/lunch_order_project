import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createGetRequest, createJsonRequest, readJson } from '../helpers.js';

const mocks = vi.hoisted(() => ({
  prisma: {
    weeklySchedule: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    order: {
      deleteMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
  getCurrentUser: vi.fn(),
}));

vi.mock('@/lib/db', () => ({ default: mocks.prisma }));
vi.mock('@/lib/auth', () => ({ getCurrentUser: mocks.getCurrentUser }));

const { GET, POST } = await import('@/app/api/schedule/route.js');

describe('/api/schedule', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.prisma.$transaction.mockImplementation(async (callback) => callback(mocks.prisma));
  });

  it('formats user orders and hides admin-only fields for normal users', async () => {
    mocks.getCurrentUser.mockResolvedValue({ userId: 'user-1', role: 'user' });
    mocks.prisma.weeklySchedule.findMany.mockResolvedValue([
      {
        id: 'sched-1',
        date: '2026-06-16',
        restaurantId: 'rest-1',
        orderDeadline: '09:40',
        isOpen: true,
        deliveredAt: null,
        restaurant: { id: 'rest-1', name: 'Cafe' },
        orders: [
          {
            id: 'order-1',
            userId: 'user-1',
            totalAmount: 120,
            note: 'less rice',
            status: 'pending',
            chargedAt: null,
            user: { id: 'user-1', name: 'User', email: 'u@example.com' },
            orderItems: [
              {
                id: 'item-1',
                menuItemId: 'menu-1',
                quantity: 1,
                unitPrice: 120,
                menuItem: { name: 'Bento' },
              },
            ],
          },
        ],
      },
    ]);

    const response = await GET(createGetRequest('http://localhost/api/schedule?startDate=2026-06-16&endDate=2026-06-16'));
    const body = await readJson(response);

    expect(response.status).toBe(200);
    expect(body[0].userOrder).toMatchObject({
      id: 'order-1',
      totalAmount: 120,
      items: [{ name: 'Bento', quantity: 1, unitPrice: 120 }],
    });
    expect(body[0].stats).toBeNull();
    expect(body[0]).not.toHaveProperty('orders');
  });

  it('includes schedule stats and orders for admins', async () => {
    mocks.getCurrentUser.mockResolvedValue({ userId: 'admin-1', role: 'admin' });
    mocks.prisma.weeklySchedule.findMany.mockResolvedValue([
      {
        id: 'sched-1',
        date: '2026-06-16',
        restaurantId: 'rest-1',
        orderDeadline: '09:40',
        isOpen: true,
        deliveredAt: null,
        restaurant: null,
        orders: [
          { id: 'o1', userId: 'u1', totalAmount: 100, status: 'pending', user: {}, orderItems: [] },
          { id: 'o2', userId: 'u2', totalAmount: 200, status: 'cancelled', user: {}, orderItems: [] },
        ],
      },
    ]);

    const response = await GET(createGetRequest('http://localhost/api/schedule'));
    const body = await readJson(response);

    expect(body[0].stats).toEqual({ totalOrders: 1, totalAmount: 100 });
    expect(body[0].orders).toHaveLength(2);
  });

  it('blocks restaurant changes when active orders exist unless clearing is requested', async () => {
    mocks.getCurrentUser.mockResolvedValue({ userId: 'admin-1', role: 'admin' });
    mocks.prisma.weeklySchedule.findUnique.mockResolvedValue({
      id: 'sched-1',
      restaurantId: 'old-rest',
      orders: [{ id: 'order-1' }],
    });

    const response = await POST(createJsonRequest('http://localhost/api/schedule', {
      date: '2026-06-16',
      restaurantId: 'new-rest',
    }));

    expect(response.status).toBe(409);
    await expect(readJson(response)).resolves.toEqual({
      error: 'Restaurant change requires clearing existing orders',
    });
  });

  it('clears active orders when changing restaurants with confirmation', async () => {
    mocks.getCurrentUser.mockResolvedValue({ userId: 'admin-1', role: 'admin' });
    mocks.prisma.weeklySchedule.findUnique.mockResolvedValue({
      id: 'sched-1',
      restaurantId: 'old-rest',
      orders: [{ id: 'order-1' }],
    });
    mocks.prisma.weeklySchedule.upsert.mockResolvedValue({ id: 'sched-1', restaurantId: 'new-rest' });

    const response = await POST(createJsonRequest('http://localhost/api/schedule', {
      date: '2026-06-16',
      restaurantId: 'new-rest',
      clearOrdersOnRestaurantChange: true,
    }));

    expect(response.status).toBe(200);
    expect(mocks.prisma.order.deleteMany).toHaveBeenCalledWith({
      where: { scheduleId: 'sched-1', status: { not: 'cancelled' } },
    });
  });
});
