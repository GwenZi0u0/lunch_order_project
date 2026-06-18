import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export async function POST(request) {
  try {
    const user = await getCurrentUser(request);
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { scheduleId } = body;

    if (!scheduleId) {
      return NextResponse.json({ error: 'Schedule ID is required' }, { status: 400 });
    }

    const schedule = await prisma.weeklySchedule.findUnique({
      where: { id: scheduleId },
      include: {
        orders: {
          where: { status: { in: ['pending', 'confirmed'] } }
        }
      }
    });

    if (!schedule) {
      return NextResponse.json({ error: 'Schedule not found' }, { status: 404 });
    }

    if (schedule.deliveredAt) {
      return NextResponse.json({ error: 'This schedule day is already marked as delivered and billed' }, { status: 400 });
    }

    const now = new Date();

    // Execute delivery and billing process atomically
    await prisma.$transaction(async (tx) => {
      // Loop over each order to deduct user balances and log transactions
      for (const order of schedule.orders) {
        // Update user balance (allow negative balance as per spec: 後付儲值制，允許負值)
        await tx.user.update({
          where: { id: order.userId },
          data: {
            balance: {
              decrement: order.totalAmount
            }
          }
        });

        // Log transaction ledger entry
        await tx.balanceTransaction.create({
          data: {
            userId: order.userId,
            type: 'charge',
            amount: -order.totalAmount,
            source: '訂單扣款',
            orderId: order.id,
            operatedBy: user.userId
          }
        });

        // Update order status to delivered and charged
        await tx.order.update({
          where: { id: order.id },
          data: {
            status: 'delivered',
            chargedAt: now
          }
        });
      }

      // Mark the schedule as delivered. Keep isOpen unchanged so delivery is not treated as a holiday.
      await tx.weeklySchedule.update({
        where: { id: scheduleId },
        data: {
          deliveredAt: now
        }
      });
    });

    return NextResponse.json({ 
      success: true, 
      message: `Successfully processed ${schedule.orders.length} order payments.` 
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
