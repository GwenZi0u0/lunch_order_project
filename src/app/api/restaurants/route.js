import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export async function GET(request) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const onlyActive = searchParams.get('active') !== 'false';

    const restaurants = await prisma.restaurant.findMany({
      where: onlyActive ? { isActive: true } : {},
      include: {
        menuItems: {
          where: { isAvailable: true }
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
    const { name, category, phone, note, menuItems } = body;

    if (!name || !category) {
      return NextResponse.json({ error: 'Name and category are required' }, { status: 400 });
    }

    // Use a transaction to create restaurant and items
    const restaurant = await prisma.$transaction(async (tx) => {
      const newRest = await tx.restaurant.create({
        data: {
          name,
          category,
          phone,
          note,
        }
      });

      if (menuItems && menuItems.length > 0) {
        await tx.menuItem.createMany({
          data: menuItems.map(item => ({
            restaurantId: newRest.id,
            name: item.name,
            price: parseInt(item.price, 10) || 0,
            category: item.category || '主食',
          }))
        });
      }

      return newRest;
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
