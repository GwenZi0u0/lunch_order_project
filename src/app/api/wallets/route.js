import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { ACTIVE_HOLD_STATUSES, withWalletHold } from '@/lib/wallet';
import { canReadAdminData } from '@/lib/adminPermissions';

const WALLET_TRANSACTION_SOURCES = ['-', '現金', '線上支付平台', '銀行轉帳'];
const PRODUCTION_TEST_ACCOUNT_NAMES = ['王大同', '管理員 Admin'];

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

function getSixMonthHistoryStart() {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const dateParts = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  const cutoff = new Date(Date.UTC(
    Number(dateParts.year),
    Number(dateParts.month) - 1 - 6,
    Number(dateParts.day),
  ));
  const cutoffKey = `${cutoff.getUTCFullYear()}-${String(cutoff.getUTCMonth() + 1).padStart(2, '0')}-${String(cutoff.getUTCDate()).padStart(2, '0')}`;
  return new Date(`${cutoffKey}T00:00:00+08:00`);
}

export async function GET(request) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'history';

    if (action === 'list_members') {
      if (!canReadAdminData(user, ['schedule'])) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const members = await prisma.user.findMany({
        where: process.env.NODE_ENV === 'production'
          ? { name: { notIn: PRODUCTION_TEST_ACCOUNT_NAMES } }
          : undefined,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          viewerPage: true
        },
        orderBy: { name: 'asc' }
      });
      return NextResponse.json(members);
    }

    if (action === 'list_users') {
      if (!canReadAdminData(user, ['wallets', 'accounting-audit'])) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      // Fetch all users with their orders and current balance
      const users = await prisma.user.findMany({
        orderBy: { name: 'asc' }
      });
      const pendingHolds = await prisma.order.groupBy({
        by: ['userId'],
        where: {
          status: { in: ACTIVE_HOLD_STATUSES },
          chargedAt: null,
          schedule: { deliveredAt: null }
        },
        _sum: { totalAmount: true }
      });
      const pendingHoldByUserId = new Map(pendingHolds.map(item => [
        item.userId,
        item._sum.totalAmount || 0
      ]));
      const usersWithHold = users.map(item => (
        withWalletHold(item, pendingHoldByUserId.get(item.id) || 0)
      ));
      return NextResponse.json(usersWithHold);
    }

    if (action === 'history') {
      const targetUserId = searchParams.get('userId');
      const scope = searchParams.get('scope');
      const startDate = searchParams.get('startDate') || '';
      const endDate = searchParams.get('endDate') || '';
      
      // Admins can see all history by default, or filter by a specific user.
      // Normal users can only see their own history.
      const canReadAllHistory = canReadAdminData(user, ['wallets', 'accounting-audit']);
      const queryUserId = scope === 'mine'
        ? user.userId
        : canReadAllHistory
        ? targetUserId || null
        : user.userId;
      
      if (!canReadAllHistory && targetUserId && targetUserId !== user.userId) {
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
      if (scope === 'mine') {
        const sixMonthStart = getSixMonthHistoryStart();
        where.createdAt = {
          ...createdAtRange,
          gte: createdAtRange?.gte && createdAtRange.gte > sixMonthStart
            ? createdAtRange.gte
            : sixMonthStart,
        };
      } else if (createdAtRange) {
        where.createdAt = createdAtRange;
      }

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
    const { targetUserId, role, viewerPage } = body;

    const validViewerPages = ['overview', 'schedule', 'order-stats', 'restaurants', 'wallets', 'accounting-audit'];
    if (!targetUserId || !['admin', 'viewer', 'user'].includes(role)) {
      return NextResponse.json({ error: 'Invalid role update data' }, { status: 400 });
    }

    if (role === 'viewer' && !validViewerPages.includes(viewerPage)) {
      return NextResponse.json({ error: 'Please select a page for the viewer' }, { status: 400 });
    }

    if (targetUserId === user.userId && role !== 'admin') {
      return NextResponse.json({ error: 'Cannot remove your own admin role' }, { status: 400 });
    }

    const updatedUser = await prisma.user.update({
      where: { id: targetUserId },
      data: { role, viewerPage: role === 'viewer' ? viewerPage : null }
    });

    return NextResponse.json({ success: true, user: updatedUser });
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

    const { targetUserId } = await request.json();
    if (!targetUserId || typeof targetUserId !== 'string') {
      return NextResponse.json({ error: 'Invalid member id' }, { status: 400 });
    }
    if (targetUserId === user.userId) {
      return NextResponse.json({ error: '不能刪除目前登入的管理者帳號。' }, { status: 400 });
    }

    const result = await prisma.$transaction(async tx => {
      const target = await tx.user.findUnique({
        where: { id: targetUserId },
        select: { id: true, name: true, role: true, balance: true },
      });
      if (!target) return { error: '找不到此成員。', status: 404 };

      if (target.balance !== 0) {
        return { error: '此成員帳款尚未結清，請先將餘額結清後再刪除。', status: 409 };
      }

      if (target.role === 'admin') {
        const adminCount = await tx.user.count({ where: { role: 'admin' } });
        if (adminCount <= 1) {
          return { error: '系統至少需要保留一位管理者，無法刪除此成員。', status: 409 };
        }
      }

      const pendingOrders = await tx.order.count({
        where: {
          userId: targetUserId,
          status: { in: ACTIVE_HOLD_STATUSES },
          chargedAt: null,
          schedule: { deliveredAt: null },
        },
      });
      if (pendingOrders > 0) {
        return { error: '此成員仍有未結帳的訂單，請先完成帳款處理後再刪除。', status: 409 };
      }

      await tx.user.delete({ where: { id: targetUserId } });
      return { success: true, name: target.name };
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({ success: true, name: result.name });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
