export type MemberState = "invited" | "active" | "left" | "removed";
export type MovementKind = "expense" | "settlement";

export interface MovementInput {
  kind: MovementKind;
  amount_minor: number;
  paidBy: string;
  participants: ReadonlyArray<{ memberId: string; amount_minor: number }>;
  memberStates?: Readonly<Record<string, MemberState>>;
}

/**
 * The invariants of a movement before it touches the database (§5.2 and §6.1):
 * a positive amount, at least one participant, only active members, and a
 * settlement that is exactly one receiver who is not the payer.
 */
export function validateMovement(input: MovementInput): void {
  if (!Number.isInteger(input.amount_minor) || input.amount_minor <= 0) {
    throw new Error("amount_minor must be a positive integer");
  }
  if (input.participants.length === 0) throw new Error("no_participants");
  const sum = input.participants.reduce((total, share) => total + share.amount_minor, 0);
  if (sum !== input.amount_minor) throw new Error("shares do not add up to the total");

  const states = input.memberStates ?? {};
  for (const share of input.participants) {
    if (share.memberId === input.paidBy) continue;
    const state = states[share.memberId];
    if (state !== undefined && state !== "active") throw new Error("participant is not active");
  }
  const payerState = states[input.paidBy];
  if (payerState !== undefined && payerState !== "active") throw new Error("payer is not active");

  if (input.kind === "settlement") {
    if (input.participants.length !== 1) throw new Error("a settlement has exactly one receiver");
    if (input.participants[0].memberId === input.paidBy) {
      throw new Error("the payer cannot be the receiver");
    }
    if (input.participants[0].amount_minor !== input.amount_minor) {
      throw new Error("a settlement pays the full amount to the receiver");
    }
  }
}
