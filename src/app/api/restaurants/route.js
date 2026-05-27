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

      await tx.menuItem.updateMany({
        where: { restaurantId: id },
        data: { isAvailable: false }
      });

      if (menuItems && menuItems.length > 0) {
        await tx.menuItem.createMany({
          data: menuItems.map(item => ({
            restaurantId: id,
            name: item.name,
            price: parseInt(item.price, 10) || 0,
            category: item.category || '主食',
          }))
        });
      }

      return updatedRest;
    });

    const finalRestaurant = await prisma.restaurant.findUnique({
      where: { id: restaurant.id },
      include: {
        menuItems: {
          where: { isAvailable: true }
        }
      }
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
