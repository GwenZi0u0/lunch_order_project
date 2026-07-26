import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

const DEFAULT_CUSTOMIZATION_OPTIONS = ['\u98ef\u5c11', '\u63db\u83dc', '\u63db\u83dc+$20'];
const CLOSED_MENU_ITEMS_KEY = 'closedMenuItemIds';

function parseClosedMenuItemIds(value) {
  try {
    const parsed = JSON.parse(value || '[]');
    return Array.isArray(parsed) ? parsed.filter(id => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

function normalizeCustomizationOptions(value) {
  if (Array.isArray(value)) {
    const options = value.map(option => String(option).trim()).filter(Boolean);
    return options;
  }

  if (typeof value === 'string') {
    if (!value.trim()) return [];

    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        const options = parsed.map(option => String(option).trim()).filter(Boolean);
        return options;
      }
      if (typeof parsed === 'string') {
        return normalizeCustomizationOptions(parsed);
      }
    } catch {
      const options = value.split(/[\r\n,;|]+/).map(option => option.trim()).filter(Boolean);
      return options;
    }
  }

  return DEFAULT_CUSTOMIZATION_OPTIONS;
}

function serializeCustomizationOptions(value) {
  return JSON.stringify(normalizeCustomizationOptions(value));
}

export async function GET(request) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const onlyActive = searchParams.get('active') !== 'false';
    const includeUnavailable = user.role === 'admin' && searchParams.get('includeUnavailable') === 'true';
    const closedSetting = includeUnavailable
      ? await prisma.siteSetting.findUnique({ where: { key: CLOSED_MENU_ITEMS_KEY } })
      : null;
    const closedMenuItemIds = closedSetting ? parseClosedMenuItemIds(closedSetting.value) : [];

    const restaurants = await prisma.restaurant.findMany({
      where: onlyActive ? { isActive: true } : {},
      include: {
        menuItems: {
          where: includeUnavailable
            ? { OR: [{ isAvailable: true }, { id: { in: closedMenuItemIds } }] }
            : { isAvailable: true }
        }
      },
      orderBy: { name: 'asc' }
    });

    return NextResponse.json(restaurants);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const user = await getCurrentUser(request);
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { name, phone, note, menuItems } = body;

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    // Use a transaction to create restaurant and items
    const restaurant = await prisma.$transaction(async (tx) => {
      const newRest = await tx.restaurant.create({
        data: {
          name,
          phone,
          note,
        }
      });

      const closedMenuItemIds = [];
      if (menuItems && menuItems.length > 0) {
        for (const item of menuItems) {
          const createdItem = await tx.menuItem.create({
            data: {
            restaurantId: newRest.id,
            name: item.name,
            price: parseInt(item.price, 10) || 0,
            customizationOptions: serializeCustomizationOptions(item.customizationOptions),
            category: item.category || '主食',
            isAvailable: item.isAvailable !== false,
            }
          });
          if (item.isAvailable === false) closedMenuItemIds.push(createdItem.id);
        }
      }

      if (closedMenuItemIds.length > 0) {
        const existingSetting = await tx.siteSetting.findUnique({ where: { key: CLOSED_MENU_ITEMS_KEY } });
        const existingIds = existingSetting ? parseClosedMenuItemIds(existingSetting.value) : [];
        await tx.siteSetting.upsert({
          where: { key: CLOSED_MENU_ITEMS_KEY },
          update: { value: JSON.stringify([...new Set([...existingIds, ...closedMenuItemIds])]) },
          create: { key: CLOSED_MENU_ITEMS_KEY, value: JSON.stringify(closedMenuItemIds) },
        });
      }

      return newRest;
    }, {
      maxWait: 10000,
      timeout: 30000
    });

    const finalRestaurant = await prisma.restaurant.findUnique({
      where: { id: restaurant.id },
      include: { menuItems: true }
    });

    return NextResponse.json(finalRestaurant);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const user = await getCurrentUser(request);
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { id, name, phone, note, menuItems } = body;

    if (!id || !name) {
      return NextResponse.json({ error: 'Restaurant ID and name are required' }, { status: 400 });
    }

    const restaurant = await prisma.$transaction(async (tx) => {
      const updatedRest = await tx.restaurant.update({
        where: { id },
        data: {
          name,
          phone,
          note,
          isActive: true,
        }
      });

      const setting = await tx.siteSetting.findUnique({ where: { key: CLOSED_MENU_ITEMS_KEY } });
      const closedIds = new Set(setting ? parseClosedMenuItemIds(setting.value) : []);
      const retainedIds = (menuItems || []).map(item => item.id).filter(Boolean);
      const removedWhere = {
        restaurantId: id,
        ...(retainedIds.length > 0 ? { id: { notIn: retainedIds } } : {}),
      };
      const removedItems = await tx.menuItem.findMany({
        where: removedWhere,
        select: { id: true },
      });

      await tx.menuItem.updateMany({
        where: removedWhere,
        data: { isAvailable: false },
      });
      removedItems.forEach(item => closedIds.delete(item.id));

      for (const item of menuItems || []) {
        const itemData = {
          name: item.name,
          price: parseInt(item.price, 10) || 0,
          customizationOptions: serializeCustomizationOptions(item.customizationOptions),
          category: item.category || '主食',
          isAvailable: item.isAvailable !== false,
        };

        let menuItemId = item.id;
        if (menuItemId) {
          await tx.menuItem.updateMany({
            where: { id: menuItemId, restaurantId: id },
            data: itemData,
          });
        } else {
          const createdItem = await tx.menuItem.create({
            data: { ...itemData, restaurantId: id },
          });
          menuItemId = createdItem.id;
        }

        if (itemData.isAvailable) closedIds.delete(menuItemId);
        else closedIds.add(menuItemId);
      }

      await tx.siteSetting.upsert({
        where: { key: CLOSED_MENU_ITEMS_KEY },
        update: { value: JSON.stringify([...closedIds]) },
        create: { key: CLOSED_MENU_ITEMS_KEY, value: JSON.stringify([...closedIds]) },
      });

      return updatedRest;
    }, {
      maxWait: 10000,
      timeout: 30000
    });

    const finalRestaurant = await prisma.restaurant.findUnique({
      where: { id: restaurant.id },
      include: { menuItems: true }
    });

    return NextResponse.json(finalRestaurant);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const user = await getCurrentUser(request);
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Restaurant ID is required' }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.restaurant.update({
        where: { id },
        data: { isActive: false }
      });

      await tx.menuItem.updateMany({
        where: { restaurantId: id },
        data: { isAvailable: false }
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
