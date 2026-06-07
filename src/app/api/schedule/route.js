import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

// Helper to get date string YYYY-MM-DD
function formatDate(date) {
  const d = new Date(date);
  let month = '' + (d.getMonth() + 1);
  let day = '' + d.getDate();
  const year = d.getFullYear();

  if (month.length < 2) month = '0' + month;
  if (day.length < 2) day = '0' + day;

  return [year, month, day].join('-');
}

export async function GET(request) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    let startDateStr = searchParams.get('startDate');
    let endDateStr = searchParams.get('endDate');

    // Default range: 7 days ago to 14 days ahead
    if (!startDateStr || !endDateStr) {
      const start = new Date();
      start.setDate(start.getDate() - 7);
      const end = new Date();
      end.setDate(end.getDate() + 14);
      
      startDateStr = formatDate(start);
      endDateStr = formatDate(end);
    }

    // Get all schedules in range
    const schedules = await prisma.weeklySchedule.findMany({
      where: {
        date: {
          gte: startDateStr,
          lte: endDateStr
        }
      },
      include: {
        restaurant: {
          include: {
            menuItems: {
              where: { isAvailable: true }
            }
          }
        },
        orders: {
          include: {
            user: {
              select: { id: true, name: true, email: true }
            },
            orderItems: {
              include: {
                menuItem: true
              }
            }
          }
        }
      },
      orderBy: { date: 'asc' }
    });

    // Format schedules to include the current user's order details in a simplified field
    const formattedSchedules = schedules.map(sched => {
      const userOrder = sched.orders.find(o => o.userId === user.userId && o.status !== 'cancelled');
      
      // Calculate order statistics for administrators
      const orderCount = sched.orders.filter(o => o.status !== 'cancelled').length;
      
      return {
        id: sched.id,
        date: sched.date,
        restaurantId: sched.restaurantId,
        orderDeadline: sched.orderDeadline,
        isOpen: sched.isOpen,
        deliveredAt: sched.deliveredAt,
        restaurant: sched.restaurant,
        userOrder: userOrder ? {
          id: userOrder.id,
          totalAmount: userOrder.totalAmount,
          note: userOrder.note,
          status: userOrder.status,
          chargedAt: userOrder.chargedAt,
          items: userOrder.orderItems.map(oi => ({
            id: oi.id,
            menuItemId: oi.menuItemId,
            name: oi.menuItem.name,
            quantity: oi.quantity,
            unitPrice: oi.unitPrice
          }))
        } : null,
        stats: user.role === 'admin' ? {
          totalOrders: orderCount,
          totalAmount: sched.orders.filter(o => o.status !== 'cancelled').reduce((sum, o) => sum + o.totalAmount, 0)
        } : null,
        orders: user.role === 'admin'
          ? sched.orders.map(order => ({
            id: order.id,
            userId: order.userId,
            user: order.user,
            totalAmount: order.totalAmount,
            note: order.note,
            status: order.status,
            chargedAt: order.chargedAt,
            orderItems: order.orderItems
          }))
          : undefined
      };
    });

    return NextResponse.json(formattedSchedules);
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
    const { date, restaurantId, orderDeadline } = body;

    if (!date || !restaurantId) {
      return NextResponse.json({ error: 'Date and Restaurant ID are required' }, { status: 400 });
    }

    const schedule = await prisma.weeklySchedule.upsert({
      where: { date },
      update: {
        restaurantId,
        orderDeadline: orderDeadline || '09:40',
      },
      create: {
        date,
        restaurantId,
        orderDeadline: orderDeadline || '09:40',
        isOpen: true
      }
    });

    return NextResponse.json(schedule);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
