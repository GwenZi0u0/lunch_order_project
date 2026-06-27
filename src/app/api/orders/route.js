import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

// Helper to get current Taipei/system date and time info
function getCurrentDateTime() {
  // Format current date as YYYY-MM-DD and time as HH:MM based on local time
  const now = new Date();
  
  // Format to local date string YYYY-MM-DD
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const dateStr = `${year}-${month}-${day}`;

  // Format to local time string HH:MM
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const timeStr = `${hours}:${minutes}`;

  return { dateStr, timeStr };
}

// Function to check if ordering is closed for a schedule
function isScheduleClosed(schedule, currentDateTime) {
  const { dateStr: currentDate, timeStr: currentTime } = currentDateTime;
  
  if (currentDate > schedule.date) {
    return true; // Past date is closed
  }
  
  if (currentDate === schedule.date) {
    // Same day, check time deadline
    const deadline = schedule.orderDeadline || '09:40';
    return currentTime >= deadline;
  }
  
  return false; // Future date is open
}

function formatOrderNumberDisplay(orderNumber) {
  if (!orderNumber) return null;
  const serial = parseInt(orderNumber.slice(-3), 10);
  if (Number.isNaN(serial)) return orderNumber.slice(-2);
  return String(serial).padStart(2, '0');
}

async function allocateOrderNumber(tx, scheduleDate) {
  const sequence = await tx.orderSequence.upsert({
    where: { date: scheduleDate },
    update: {
      lastNumber: {
        increment: 1
      }
    },
    create: {
      date: scheduleDate,
      lastNumber: 1
    }
  });

  return `${scheduleDate.replaceAll('-', '')}${String(sequence.lastNumber).padStart(3, '0')}`;
}

export async function GET(request) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const scheduleId = searchParams.get('scheduleId');

    if (user.role === 'admin') {
      // Admins can fetch all orders for a schedule
      const query = {
        where: { status: { not: 'cancelled' } },
        orderBy: { orderNumber: 'asc' },
        include: {
          user: {
            select: { id: true, name: true, email: true, balance: true }
          },
          orderItems: {
            include: {
              menuItem: true
            }
          }
        }
      };

      if (scheduleId) {
        query.where.scheduleId = scheduleId;
      }

      const orders = await prisma.order.findMany(query);
      return NextResponse.json(orders.map(order => ({
        ...order,
        orderNumberDisplay: formatOrderNumberDisplay(order.orderNumber)
      })));
    } else {
      // Normal users can only fetch their own orders
      const query = {
        where: {
          userId: user.userId,
          status: { not: 'cancelled' }
        },
        include: {
          orderItems: {
            include: {
              menuItem: true
            }
          },
          schedule: {
            include: {
              restaurant: true
            }
          }
        },
        orderBy: [
          { schedule: { date: 'desc' } },
          { orderNumber: 'asc' }
        ]
      };

      if (scheduleId) {
        query.where.scheduleId = scheduleId;
      }

      const orders = await prisma.order.findMany(query);
      return NextResponse.json(orders.map(order => ({
        ...order,
        orderNumberDisplay: formatOrderNumberDisplay(order.orderNumber)
      })));
    }
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { scheduleId, items, note, targetUserId } = body; // items: [{ menuItemId, quantity, note }]
    const isAdminOverride = user.role === 'admin' && targetUserId;
    const orderUserId = isAdminOverride ? targetUserId : user.userId;

    if (!scheduleId || !items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Invalid order input' }, { status: 400 });
    }

    if (isAdminOverride) {
      const targetUser = await prisma.user.findUnique({
        where: { id: targetUserId }
      });

      if (!targetUser) {
        return NextResponse.json({ error: 'Target user not found' }, { status: 404 });
      }
    }

    // Retrieve schedule
    const schedule = await prisma.weeklySchedule.findUnique({
      where: { id: scheduleId }
    });

    if (!schedule) {
      return NextResponse.json({ error: 'Schedule not found' }, { status: 404 });
    }

    if (!schedule.isOpen || !schedule.restaurantId) {
      return NextResponse.json({ error: 'This date is marked as a holiday or has no restaurant scheduled' }, { status: 400 });
    }

    if (schedule.deliveredAt) {
      return NextResponse.json({ error: 'This schedule has already been delivered and billed' }, { status: 400 });
    }

    // Enforcement of deadline (09:40)
    const currentDT = getCurrentDateTime();
    if (!isAdminOverride && isScheduleClosed(schedule, currentDT)) {
      return NextResponse.json({
        error: `Ordering is closed. Deadline is ${schedule.orderDeadline}.`
      }, { status: 400 });
    }

    // Resolve menu items prices
    const menuItemIds = items.map(i => i.menuItemId);
    const menuItems = await prisma.menuItem.findMany({
      where: { id: { in: menuItemIds } }
    });

    if (menuItems.length !== items.length) {
      return NextResponse.json({ error: 'Some menu items were not found' }, { status: 400 });
    }

    // Calculate total amount
    let totalAmount = 0;
    const orderItemsData = items.map(item => {
      const dbItem = menuItems.find(mi => mi.id === item.menuItemId);
      const price = dbItem.price;
      const quantity = parseInt(item.quantity, 10) || 1;
      totalAmount += price * quantity;
      
      return {
        menuItemId: item.menuItemId,
        quantity,
        unitPrice: price, // Snapshot price
        note: typeof item.note === 'string' ? item.note.trim() : null
      };
    });

    // Execute order creation/update in a transaction. Existing orders keep their number.
    const order = await prisma.$transaction(async (tx) => {
      // Find existing order for this schedule and user
      const existingOrder = await tx.order.findFirst({
        where: {
          userId: orderUserId,
          scheduleId: scheduleId,
          status: { not: 'cancelled' }
        }
      });

      if (existingOrder) {
        const orderNumber = existingOrder.orderNumber || await allocateOrderNumber(tx, schedule.date);

        await tx.orderItem.deleteMany({
          where: { orderId: existingOrder.id }
        });

        return tx.order.update({
          where: { id: existingOrder.id },
          data: {
            orderNumber,
            totalAmount,
            note,
            status: 'pending',
            chargedAt: null,
            orderItems: {
              create: orderItemsData
            }
          },
          include: {
            orderItems: true
          }
        });
      }

      const orderNumber = await allocateOrderNumber(tx, schedule.date);

      // Create new order
      const newOrder = await tx.order.create({
        data: {
          orderNumber,
          userId: orderUserId,
          scheduleId,
          totalAmount,
          note,
          status: 'pending',
          orderItems: {
            create: orderItemsData
          }
        },
        include: {
          orderItems: true
        }
      });

      return newOrder;
    });

    return NextResponse.json({
      success: true,
      order: {
        ...order,
        orderNumberDisplay: formatOrderNumberDisplay(order.orderNumber)
      }
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get('orderId');

    if (!orderId) {
      return NextResponse.json({ error: 'Order ID is required' }, { status: 400 });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { schedule: true }
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Verify it is user's own order, or they are admin
    if (order.userId !== user.userId && user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (order.schedule.deliveredAt) {
      return NextResponse.json({ error: 'This schedule has already been delivered and billed' }, { status: 400 });
    }

    // Enforcement of deadline (09:40)
    const currentDT = getCurrentDateTime();
    if (user.role !== 'admin' && isScheduleClosed(order.schedule, currentDT)) {
      return NextResponse.json({
        error: `Order cancellation is closed. Deadline is ${order.schedule.orderDeadline}.`
      }, { status: 400 });
    }

    // Soft-cancel orders so their order numbers remain burned and auditable.
    await prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'cancelled'
      }
    });

    return NextResponse.json({ success: true, message: 'Order cancelled successfully' });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
