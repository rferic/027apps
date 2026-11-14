export interface BalanceMovement {
  paidBy: string;
  amount_minor: number;
  shares: ReadonlyArray<{ memberId: string; amount_minor: number }>;
  deleted?: boolean;
}

/**
 * `balance = paid - owed`, the same formula for an expense and a settlement:
 * in a settlement the only share is the receiver's. Deleted movements do not
 * count; the sum of every balance is always zero.
 */
export function computeBalances(movements: readonly BalanceMovement[]): Map<string, number> {
  const balances = new Map<string, number>();
  const add = (memberId: string, delta: number) =>
    balances.set(memberId, (balances.get(memberId) ?? 0) + delta);

  for (const movement of movements) {
    if (movement.deleted) continue;
    add(movement.paidBy, movement.amount_minor);
    for (const share of movement.shares) add(share.memberId, -share.amount_minor);
  }
  return balances;
}

/** Non-zero balances in canonical order, which is what the settlement takes. */
export function nonZeroBalances(balances: ReadonlyMap<string, number>): Array<[string, number]> {
  return [...balances.entries()]
    .filter(([, amount]) => amount !== 0)
    .sort(([left], [right]) => left.localeCompare(right));
}
