import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

const WALLET_TRANSACTION_SOURCES = ['-', '現金', '線上支付平台', '銀行轉帳'];

function getTaipeiDateRange(startDate, endDate) {
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  const hasStart = typeof startDate === 'string' && startDate.length > 0;
  const hasEnd = typeof endDate === 'string' && endDate.length > 0;

  if ((hasStart && !datePattern.test(startDate)) || (hasEnd && !datePattern.test(endDate))) {
    throw new Error('Invalid date filter');
  }

  if (!hasStart && !hasEnd) return null;

  const range = {};
  const effectiveEndDate = hasEnd ? endDate : startDate;

  if (hasStart) {
    range.gte = new Date(`${startDate}T00:00:00+08:00`);
  }

  if (effectiveEndDate) {
    range.lt = new Date(`${effectiveEndDate}T00:00:00+08:00`);
    range.lt.setUTCDate(range.lt.getUTCDate() + 1);
  }

  if (range.gte && range.lt && range.gte >= range.lt) {
    throw new Error('Invalid date range');
  }

  return range;
}

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
      const startDate = searchParams.get('startDate') || '';
      const endDate = searchParams.get('endDate') || '';
      
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

      let createdAtRange;
      try {
        createdAtRange = getTaipeiDateRange(startDate, endDate);
      } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      const where = {};
      if (queryUserId) where.userId = queryUserId;
      if (createdAtRange) where.createdAt = createdAtRange;

      const transactions = await prisma.balanceTransaction.findMany({
        where,
        include: {
          user: {
            select: { id: true, name: true, email: true }
          },
          operator: {
            select: { id: true, name: true }
          },
          order: {
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
    const { targetUserId, type, amount, source, note } = body;
    const numericAmount = parseInt(amount, 10);
    const normalizedSource = typeof source === 'string' ? source.trim() : '';
    const normalizedNote = typeof note === 'string' ? note.trim() : '';

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
          note: normalizedNote || null,
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
