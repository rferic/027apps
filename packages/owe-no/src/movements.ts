import { OweDomainError } from "./errors";

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
    throw new OweDomainError("validation_failed", "amount_minor must be a positive integer");
  }
  if (input.participants.length === 0) throw new OweDomainError("validation_failed", "no_participants");
  const sum = input.participants.reduce((total, share) => total + share.amount_minor, 0);
  if (sum !== input.amount_minor) throw new OweDomainError("validation_failed", "shares do not add up to the total");

  // An invited account still counts as a person of the group: the owner's rule
  // is that it behaves like a fictitious member (charges can be assigned to it)
  // until it accepts and takes over that same balance.
  const canBeCharged = (state: string | undefined) => state === undefined || state === "active" || state === "invited";
  const states = input.memberStates ?? {};
  for (const share of input.participants) {
    if (share.memberId === input.paidBy) continue;
    if (!canBeCharged(states[share.memberId])) throw new OweDomainError("validation_failed", "participant is not in this group");
  }
  if (!canBeCharged(states[input.paidBy])) throw new OweDomainError("validation_failed", "payer is not in this group");

  if (input.kind === "settlement") {
    if (input.participants.length !== 1) throw new OweDomainError("validation_failed", "a settlement has exactly one receiver");
    if (input.participants[0].memberId === input.paidBy) {
      throw new OweDomainError("validation_failed", "the payer cannot be the receiver");
    }
    if (input.participants[0].amount_minor !== input.amount_minor) {
      throw new OweDomainError("validation_failed", "a settlement pays the full amount to the receiver");
    }
  }
}
