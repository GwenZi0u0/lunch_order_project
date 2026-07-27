import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

const DEFAULT_CUSTOMIZATION_OPTIONS = ['\u98ef\u5c11', '\u63db\u83dc', '\u63db\u83dc+$20'];
const CLOSED_MENU_ITEMS_KEY = 'closedMenuItemIds';
const CATEGORY_ORDER_KEY_PREFIX = 'restaurantCategoryOrder:';

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

function normalizeCategoryOrder(value, menuItems = []) {
  const categories = [...new Set(
    (menuItems || []).map(item => String(item.category || '餐盒').trim()).filter(Boolean)
  )];
  const requestedOrder = Array.isArray(value)
    ? value.map(category => String(category).trim()).filter(category => categories.includes(category))
    : [];
  if (requestedOrder.length === 0) {
    const priority = category => {
      if (category.includes('餐盒')) return 0;
      if (category.includes('義大利麵')) return 1;
      if (/單點|加點/.test(category)) return 2;
      if (/飲料|飲品/.test(category)) return 3;
      return 4;
    };
    return categories.sort((a, b) => priority(a) - priority(b) || a.localeCompare(b, 'zh-Hant'));
  }
  return [...new Set([...requestedOrder, ...categories])];
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
    const categoryOrderSettings = await prisma.siteSetting.findMany({
      where: { key: { startsWith: CATEGORY_ORDER_KEY_PREFIX } }
    });
    const categoryOrderByRestaurantId = new Map(categoryOrderSettings.map(setting => [
      setting.key.slice(CATEGORY_ORDER_KEY_PREFIX.length),
      (() => {
        try {
          return JSON.parse(setting.value || '[]');
        } catch {
          return [];
        }
      })()
    ]));

    return NextResponse.json(restaurants.map(restaurant => ({
      ...restaurant,
      categoryOrder: normalizeCategoryOrder(
        categoryOrderByRestaurantId.get(restaurant.id),
        restaurant.menuItems
      )
    })));
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
    const { name, phone, note, menuItems, categoryOrder } = body;

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

      const normalizedCategoryOrder = normalizeCategoryOrder(categoryOrder, menuItems);
      await tx.siteSetting.upsert({
        where: { key: `${CATEGORY_ORDER_KEY_PREFIX}${newRest.id}` },
        update: { value: JSON.stringify(normalizedCategoryOrder) },
        create: {
          key: `${CATEGORY_ORDER_KEY_PREFIX}${newRest.id}`,
          value: JSON.stringify(normalizedCategoryOrder)
        }
      });

      return newRest;
    });

    const finalRestaurant = await prisma.restaurant.findUnique({
      where: { id: restaurant.id },
      include: { menuItems: true }
    });

    return NextResponse.json({
      ...finalRestaurant,
      categoryOrder: normalizeCategoryOrder(categoryOrder, finalRestaurant.menuItems)
    });
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
    const { id, name, phone, note, menuItems, categoryOrder } = body;

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

      const normalizedCategoryOrder = normalizeCategoryOrder(categoryOrder, menuItems);
      await tx.siteSetting.upsert({
        where: { key: `${CATEGORY_ORDER_KEY_PREFIX}${id}` },
        update: { value: JSON.stringify(normalizedCategoryOrder) },
        create: {
          key: `${CATEGORY_ORDER_KEY_PREFIX}${id}`,
          value: JSON.stringify(normalizedCategoryOrder)
        }
      });

      return updatedRest;
    });

    const finalRestaurant = await prisma.restaurant.findUnique({
      where: { id: restaurant.id },
      include: { menuItems: true }
    });

    return NextResponse.json({
      ...finalRestaurant,
      categoryOrder: normalizeCategoryOrder(categoryOrder, finalRestaurant.menuItems)
    });
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
