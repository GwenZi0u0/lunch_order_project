import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

const WALLET_TRANSACTION_SOURCES = ['-', '現金', '線上支付平台', '銀行轉帳'];

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
      const scope = searchParams.get('scope');
      
      // Admins can see all history by default, or filter by a specific user.
      // Normal users can only see their own history.
      const queryUserId = scope === 'mine'
        ? user.userId
        : user.role === 'admin'
        ? targetUserId || null
        : user.userId;
      
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
    const { targetUserId, type, amount, source } = body;
    const numericAmount = parseInt(amount, 10);
    const normalizedSource = typeof source === 'string' ? source.trim() : '';

    if (!targetUserId || !type || !Number.isFinite(numericAmount)) {
      return NextResponse.json({ error: 'Invalid wallet transaction data' }, { status: 400 });
    }

    if (type === 'topup' && numericAmount <= 0) {
      return NextResponse.json({ error: 'Topup amount must be greater than 0' }, { status: 400 });
    }

    if (type === 'adjustment' && numericAmount === 0) {
      return NextResponse.json({ error: 'Adjustment amount cannot be 0' }, { status: 400 });
    }

    if (!['topup', 'adjustment'].includes(type)) {
      return NextResponse.json({ error: 'Invalid wallet transaction type' }, { status: 400 });
    }

    if (!WALLET_TRANSACTION_SOURCES.includes(normalizedSource)) {
      return NextResponse.json({ error: 'Invalid wallet transaction source' }, { status: 400 });
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId }
    });

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const transactionAmount = type === 'topup' ? numericAmount : numericAmount;

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
          source: normalizedSource,
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

export async function PATCH(request) {
  try {
    const user = await getCurrentUser(request);
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { targetUserId, role } = body;

    if (!targetUserId || !['admin', 'user'].includes(role)) {
      return NextResponse.json({ error: 'Invalid role update data' }, { status: 400 });
    }

    if (targetUserId === user.userId && role !== 'admin') {
      return NextResponse.json({ error: 'Cannot remove your own admin role' }, { status: 400 });
    }

    const updatedUser = await prisma.user.update({
      where: { id: targetUserId },
      data: { role }
    });

    return NextResponse.json({ success: true, user: updatedUser });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
