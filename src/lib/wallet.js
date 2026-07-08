export const MIN_AVAILABLE_BALANCE = -200;
export const ACTIVE_HOLD_STATUSES = ['pending', 'confirmed'];

export async function getPendingHoldAmount(client, userId, options = {}) {
  if (!userId) return 0;

  const where = {
    userId,
    status: { in: ACTIVE_HOLD_STATUSES },
    chargedAt: null,
    schedule: {
      deliveredAt: null
    }
  };

  if (options.excludeOrderId) {
    where.id = { not: options.excludeOrderId };
  }

  const result = await client.order.aggregate({
    where,
    _sum: {
      totalAmount: true
    }
  });

  return result._sum.totalAmount || 0;
}

export function withWalletHold(user, pendingHoldAmount = 0) {
  if (!user) return user;

  return {
    ...user,
    pendingHoldAmount,
    availableBalance: user.balance - pendingHoldAmount
  };
}
