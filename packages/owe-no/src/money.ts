/** Money is integer minor units plus an ISO 4217 code; never a float. */
export type Money = { amount_minor: number; currency: string };

const ISO = /^[A-Z]{3}$/;

export function assertMoney(money: Money): void {
  if (!Number.isInteger(money.amount_minor) || money.amount_minor <= 0) {
    throw new Error("amount_minor must be a positive integer");
  }
  if (!ISO.test(money.currency)) throw new Error("currency must be an ISO 4217 code");
}

/**
 * Equal split of `total` among `memberIds`, the first `remainder` in canonical
 * (id ascending) order taking one extra minor unit. The sum is always exact.
 */
export function splitEqual(total: number, memberIds: readonly string[]): Array<{ memberId: string; amount_minor: number }> {
  if (!Number.isInteger(total) || total <= 0) throw new Error("total must be a positive integer");
  if (memberIds.length === 0) throw new Error("no_participants");
  const ids = [...new Set(memberIds)].sort((a, b) => a.localeCompare(b));
  if (ids.length !== memberIds.length) throw new Error("duplicate participants");
  const base = Math.floor(total / ids.length);
  const remainder = total % ids.length;
  return ids.map((memberId, index) => ({
    memberId,
    amount_minor: base + (index < remainder ? 1 : 0),
  }));
}

/**
 * Exact split: the caller sends every participant with its amount. The sum must
 * equal the total and no amount may be negative.
 */
export function validateExactShares(
  total: number,
  shares: ReadonlyArray<{ memberId: string; amount_minor: number }>,
): void {
  if (shares.length === 0) throw new Error("no_participants");
  const ids = new Set(shares.map((share) => share.memberId));
  if (ids.size !== shares.length) throw new Error("duplicate participants");
  if (shares.some((share) => !Number.isInteger(share.amount_minor) || share.amount_minor < 0)) {
    throw new Error("a share cannot be negative");
  }
  const sum = shares.reduce((totalMinor, share) => totalMinor + share.amount_minor, 0);
  if (sum !== total) throw new Error("shares do not add up to the total");
}
