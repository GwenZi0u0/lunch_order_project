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
    const action = searchParams.get('action') || 'history';

    if (action === 'list_users') {
      if (user.role !== 'admin') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      // Fetch all users with their orders and current balance
      const users = await prisma.user.findMany({
        orderBy: { name: 'asc' }
      });
      return NextResponse.json(users);
    }

    if (action === 'history') {
      const targetUserId = searchParams.get('userId');
      
      // Normal users can only see their own history
      const queryUserId = user.role === 'admin' && targetUserId ? targetUserId : user.userId;
      
      if (user.role !== 'admin' && targetUserId && targetUserId !== user.userId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const transactions = await prisma.balanceTransaction.findMany({
        where: queryUserId ? { userId: queryUserId } : {},
        include: {
          user: {
            select: { id: true, name: true, email: true }
          },
          operator: {
            select: { id: true, name: true }
          },
          order: {
            include: {
              schedule: {
                include: {
                  restaurant: true
                }
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      return NextResponse.json(transactions);
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
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
    const { targetUserId, type, amount } = body; // type: 'topup', amount: Int (positive number)

    if (!targetUserId || !type || !amount || amount <= 0) {
      return NextResponse.json({ error: 'Invalid wallet transaction data' }, { status: 400 });
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId }
    });

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const transactionAmount = type === 'topup' ? amount : -amount;

    // Use transaction to update user's balance and insert ledger record
    const updatedUser = await prisma.$transaction(async (tx) => {
      // Update balance
      const updated = await tx.user.update({
        where: { id: targetUserId },
        data: {
          balance: {
            increment: transactionAmount
          }
        }
      });

      // Log transaction
      await tx.balanceTransaction.create({
        data: {
          userId: targetUserId,
          type,
          amount: transactionAmount,
          operatedBy: user.userId,
        }
      });

      return updated;
    });

    return NextResponse.json({ success: true, balance: updatedUser.balance });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
