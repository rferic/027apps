export interface Transfer {
  from: string;
  to: string;
  amount_minor: number;
}

export interface SettlementPlan {
  transfers: Transfer[];
  /** False when the group is too large and the plan is the greedy fallback. */
  exact: boolean;
}

/**
 * Minimal settlement: every member with a debt pays it in the fewest possible
 * transfers. With more members than `limit`, a deterministic greedy plan is
 * returned instead and `exact` is false, so the UI can say so.
 */
export function settle(
  balances: ReadonlyArray<[string, number]>,
  limit: number,
): SettlementPlan {
  const open = balances
    .filter(([, amount]) => amount !== 0)
    .map(([memberId, amount]) => ({ memberId, amount }))
    .sort((left, right) => left.memberId.localeCompare(right.memberId));
  if (open.length === 0) return { transfers: [], exact: true };
  if (open.length > limit) return { transfers: greedy(open), exact: false };
  const plan = exact(open);
  if (!plan.complete) return { transfers: greedy(open), exact: false };
  return { transfers: plan.transfers, exact: true };
}

/** Backtracking: settle the first open member against one counterpart. */
function exact(
  open: Array<{ memberId: string; amount: number }>,
): { transfers: Transfer[]; complete: boolean } {
  let best: Transfer[] | null = null;
  const amounts = open.map((entry) => entry.amount);
  // The search is exponential; a budget keeps a pathological group from
  // hanging the request. Exhausting it is reported so the UI can degrade.
  let budget = 200_000;

  const walk = (transfers: Transfer[]): void => {
    if (budget <= 0) return;
    budget -= 1;
    if (best !== null && transfers.length >= best.length) return;
    const index = amounts.findIndex((amount) => amount !== 0);
    if (index === -1) {
      best = [...transfers];
      return;
    }
    const amount = amounts[index];
    for (let other = 0; other < amounts.length; other += 1) {
      const counterpart = amounts[other];
      if (index === other || counterpart === 0 || Math.sign(counterpart) === Math.sign(amount)) {
        continue;
      }
      const moved = Math.min(Math.abs(amount), Math.abs(counterpart));
      amounts[index] = amount - Math.sign(amount) * moved;
      amounts[other] = counterpart + Math.sign(amount) * moved;
      transfers.push(
        amount > 0
          ? { from: open[other].memberId, to: open[index].memberId, amount_minor: moved }
          : { from: open[index].memberId, to: open[other].memberId, amount_minor: moved },
      );
      walk(transfers);
      transfers.pop();
      amounts[index] = amount;
      amounts[other] = counterpart;
    }
  };

  walk([]);
  return { transfers: best ?? [], complete: budget > 0 };
}

/** Largest debtor against largest creditor, deterministic on ties. */
function greedy(open: Array<{ memberId: string; amount: number }>): Transfer[] {
  const debtors = open
    .filter((entry) => entry.amount < 0)
    .map((entry) => ({ memberId: entry.memberId, amount: -entry.amount }))
    .sort((left, right) => right.amount - left.amount || left.memberId.localeCompare(right.memberId));
  const creditors = open
    .filter((entry) => entry.amount > 0)
    .map((entry) => ({ memberId: entry.memberId, amount: entry.amount }))
    .sort((left, right) => right.amount - left.amount || left.memberId.localeCompare(right.memberId));

  const transfers: Transfer[] = [];
  let debtor = 0;
  let creditor = 0;
  while (debtor < debtors.length && creditor < creditors.length) {
    const moved = Math.min(debtors[debtor].amount, creditors[creditor].amount);
    if (moved > 0) {
      transfers.push({
        from: debtors[debtor].memberId,
        to: creditors[creditor].memberId,
        amount_minor: moved,
      });
    }
    debtors[debtor].amount -= moved;
    creditors[creditor].amount -= moved;
    if (debtors[debtor].amount === 0) debtor += 1;
    if (creditors[creditor].amount === 0) creditor += 1;
  }
  return transfers;
}
