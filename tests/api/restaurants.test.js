import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createGetRequest, createJsonRequest, readJson } from '../helpers.js';

const mocks = vi.hoisted(() => ({
  prisma: {
    restaurant: {
      findMany: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    menuItem: {
      createMany: vi.fn(),
      updateMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
  getCurrentUser: vi.fn(),
}));

vi.mock('@/lib/db', () => ({ default: mocks.prisma }));
vi.mock('@/lib/auth', () => ({ getCurrentUser: mocks.getCurrentUser }));

const { GET, POST, PUT, DELETE } = await import('@/app/api/restaurants/route.js');

describe('/api/restaurants', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.prisma.$transaction.mockImplementation(async (callback) => callback(mocks.prisma));
  });

  it('rejects unauthenticated list requests', async () => {
    mocks.getCurrentUser.mockResolvedValue(null);

    const response = await GET(createGetRequest('http://localhost/api/restaurants'));

    expect(response.status).toBe(401);
    await expect(readJson(response)).resolves.toEqual({ error: 'Unauthorized' });
  });

  it('lists only active restaurants by default with available menu items', async () => {
    mocks.getCurrentUser.mockResolvedValue({ userId: 'user-1', role: 'user' });
    mocks.prisma.restaurant.findMany.mockResolvedValue([{ id: 'rest-1', name: 'Cafe' }]);

    const response = await GET(createGetRequest('http://localhost/api/restaurants'));

    expect(response.status).toBe(200);
    expect(mocks.prisma.restaurant.findMany).toHaveBeenCalledWith({
      where: { isActive: true },
      include: { menuItems: { where: { isAvailable: true } } },
      orderBy: { name: 'asc' },
    });
    await expect(readJson(response)).resolves.toEqual([{ id: 'rest-1', name: 'Cafe' }]);
  });

  it('lets admins create a restaurant with menu items', async () => {
    mocks.getCurrentUser.mockResolvedValue({ userId: 'admin-1', role: 'admin' });
    mocks.prisma.restaurant.create.mockResolvedValue({ id: 'rest-1', name: 'Cafe' });
    mocks.prisma.restaurant.findUnique.mockResolvedValue({
      id: 'rest-1',
      name: 'Cafe',
      menuItems: [{ name: 'Bento', price: 120 }],
    });

    const response = await POST(createJsonRequest('http://localhost/api/restaurants', {
      name: 'Cafe',
      phone: '02-1234-5678',
      note: 'Cash only',
      menuItems: [{ name: 'Bento', price: '120', category: 'Main' }],
    }));

    expect(response.status).toBe(200);
    expect(mocks.prisma.restaurant.create).toHaveBeenCalledWith({
      data: { name: 'Cafe', phone: '02-1234-5678', note: 'Cash only' },
    });
    expect(mocks.prisma.menuItem.createMany).toHaveBeenCalledWith({
      data: [{ restaurantId: 'rest-1', name: 'Bento', price: 120, category: 'Main' }],
    });
    await expect(readJson(response)).resolves.toMatchObject({ id: 'rest-1', name: 'Cafe' });
  });

  it('forbids non-admin mutations', async () => {
    mocks.getCurrentUser.mockResolvedValue({ userId: 'user-1', role: 'user' });

    const response = await POST(createJsonRequest('http://localhost/api/restaurants', {
      name: 'Cafe',
    }));

    expect(response.status).toBe(403);
  });

  it('soft-deletes a restaurant and its menu items', async () => {
    mocks.getCurrentUser.mockResolvedValue({ userId: 'admin-1', role: 'admin' });

    const response = await DELETE(createGetRequest('http://localhost/api/restaurants?id=rest-1'));

    expect(response.status).toBe(200);
    expect(mocks.prisma.restaurant.update).toHaveBeenCalledWith({
      where: { id: 'rest-1' },
      data: { isActive: false },
    });
    expect(mocks.prisma.menuItem.updateMany).toHaveBeenCalledWith({
      where: { restaurantId: 'rest-1' },
      data: { isAvailable: false },
    });
  });

  it('requires an id and name when updating a restaurant', async () => {
    mocks.getCurrentUser.mockResolvedValue({ userId: 'admin-1', role: 'admin' });

    const response = await PUT(createJsonRequest('http://localhost/api/restaurants', {
      id: 'rest-1',
      name: '',
    }, { method: 'PUT' }));

    expect(response.status).toBe(400);
  });
});
