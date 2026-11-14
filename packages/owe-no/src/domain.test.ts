import { describe, expect, it } from "vitest";
import { splitEqual, validateExactShares } from "./money";
import { validateMovement } from "./movements";
import { computeBalances, nonZeroBalances } from "./balances";
import { settle } from "./settlement";

const sum = (shares: ReadonlyArray<{ amount_minor: number }>) =>
  shares.reduce((total, share) => total + share.amount_minor, 0);

describe("equal split", () => {
  it("repartes the remainder by member id, exactly", () => {
    const shares = splitEqual(1000, ["b", "a", "c"]);
    expect(shares).toEqual([
      { memberId: "a", amount_minor: 334 },
      { memberId: "b", amount_minor: 333 },
      { memberId: "c", amount_minor: 333 },
    ]);
    expect(sum(shares)).toBe(1000);
  });

  it("works for one participant and for many", () => {
    expect(splitEqual(999, ["a"])).toEqual([{ memberId: "a", amount_minor: 999 }]);
    const shares = splitEqual(1001, ["a", "b", "c", "d", "e", "f", "g"]);
    expect(sum(shares)).toBe(1001);
  });

  it("refuses an empty or duplicated selection", () => {
    expect(() => splitEqual(100, [])).toThrow(/no_participants/);
    expect(() => splitEqual(100, ["a", "a"])).toThrow(/duplicate/);
  });
});

describe("exact split", () => {
  it("accepts shares that add up to the total", () => {
    expect(() =>
      validateExactShares(1000, [
        { memberId: "a", amount_minor: 700 },
        { memberId: "b", amount_minor: 300 },
      ]),
    ).not.toThrow();
  });

  it("rejects a wrong total, a negative share or a duplicate", () => {
    expect(() => validateExactShares(1000, [{ memberId: "a", amount_minor: 999 }])).toThrow(/add up/);
    expect(() =>
      validateExactShares(100, [
        { memberId: "a", amount_minor: 150 },
        { memberId: "b", amount_minor: -50 },
      ]),
    ).toThrow(/negative/);
    expect(() =>
      validateExactShares(100, [
        { memberId: "a", amount_minor: 50 },
        { memberId: "a", amount_minor: 50 },
      ]),
    ).toThrow(/duplicate/);
  });
});

describe("movement rules", () => {
  const states = { ana: "active", luis: "active", marta: "invited" } as const;

  it("accepts an expense whose payer does not participate", () => {
    expect(() =>
      validateMovement({
        kind: "expense",
        amount_minor: 900,
        paidBy: "ana",
        participants: [{ memberId: "luis", amount_minor: 900 }],
        memberStates: states,
      }),
    ).not.toThrow();
  });

  it("refuses an invited participant, an empty split or a bad total", () => {
    expect(() =>
      validateMovement({
        kind: "expense",
        amount_minor: 100,
        paidBy: "ana",
        participants: [{ memberId: "marta", amount_minor: 100 }],
        memberStates: states,
      }),
    ).toThrow(/not active/);
    expect(() =>
      validateMovement({ kind: "expense", amount_minor: 100, paidBy: "ana", participants: [] }),
    ).toThrow(/no_participants/);
    expect(() =>
      validateMovement({
        kind: "expense",
        amount_minor: 100,
        paidBy: "ana",
        participants: [{ memberId: "luis", amount_minor: 90 }],
      }),
    ).toThrow(/add up/);
  });

  it("a settlement is one receiver who is not the payer", () => {
    expect(() =>
      validateMovement({
        kind: "settlement",
        amount_minor: 500,
        paidBy: "luis",
        participants: [{ memberId: "ana", amount_minor: 500 }],
        memberStates: states,
      }),
    ).not.toThrow();
    expect(() =>
      validateMovement({
        kind: "settlement",
        amount_minor: 500,
        paidBy: "luis",
        participants: [{ memberId: "luis", amount_minor: 500 }],
      }),
    ).toThrow(/receiver/);
    expect(() =>
      validateMovement({
        kind: "settlement",
        amount_minor: 500,
        paidBy: "luis",
        participants: [
          { memberId: "ana", amount_minor: 250 },
          { memberId: "marta", amount_minor: 250 },
        ],
      }),
    ).toThrow(/exactly one/);
  });
});

describe("balances", () => {
  it("adds what you paid and subtracts what you owe, expenses and settlements alike", () => {
    const balances = computeBalances([
      { paidBy: "ana", amount_minor: 900, shares: [{ memberId: "ana", amount_minor: 450 }, { memberId: "luis", amount_minor: 450 }] },
      { paidBy: "luis", amount_minor: 450, shares: [{ memberId: "ana", amount_minor: 450 }] },
      { paidBy: "ana", amount_minor: 100, shares: [{ memberId: "luis", amount_minor: 100 }], deleted: true },
    ]);
    // Ana pays 900 split 50/50 and Luis pays her back: both end at zero.
    expect(balances.get("ana")).toBe(0);
    expect(balances.get("luis")).toBe(0);
    expect([...balances.values()].reduce((a, b) => a + b, 0)).toBe(0);
    expect(nonZeroBalances(balances)).toEqual([]);
  });
});

describe("settlement", () => {
  const total = (transfers: ReadonlyArray<{ amount_minor: number }>) =>
    transfers.reduce((sumMinor, transfer) => sumMinor + transfer.amount_minor, 0);

  it("settles two members with one transfer", () => {
    expect(settle([["ana", 1000], ["luis", -1000]], 12)).toEqual({
      transfers: [{ from: "luis", to: "ana", amount_minor: 1000 }],
      exact: true,
    });
  });

  it("finds the minimum with three members", () => {
    const plan = settle([["a", 500], ["b", 500], ["c", -1000]], 12);
    expect(plan.transfers).toHaveLength(2);
    expect(total(plan.transfers)).toBe(1000);
    expect(plan.exact).toBe(true);
  });

  it("does not need a transfer when one member can settle several", () => {
    const plan = settle([["a", 300], ["b", -100], ["c", -200]], 12);
    expect(plan.transfers).toHaveLength(2);
    expect(plan.transfers.map((transfer) => transfer.from).sort()).toEqual(["b", "c"]);
  });

  it("is deterministic regardless of the input order", () => {
    const first = settle([["c", -1000], ["a", 500], ["b", 500]], 12);
    const second = settle([["a", 500], ["b", 500], ["c", -1000]], 12);
    expect(first).toEqual(second);
  });

  it("falls back to the greedy plan above the limit and says so", () => {
    const balances: Array<[string, number]> = Array.from({ length: 13 }, (_, index) =>
      index === 0 ? ["m0", 1200] : [`m${index}`, -100],
    );
    const plan = settle(balances, 12);
    expect(plan.exact).toBe(false);
    expect(total(plan.transfers)).toBe(1200);
    // Every debt is paid exactly once.
    expect(plan.transfers.every((transfer) => transfer.amount_minor === 100)).toBe(true);
  });

  it("searches the exact minimum within the limit", () => {
    const balances: Array<[string, number]> = [
      ["a", 700],
      ["b", 500],
      ["c", -300],
      ["d", -450],
      ["e", -450],
    ];
    const plan = settle(balances, 12);
    expect(plan.exact).toBe(true);
    // Four debtors/creditors, and no amount matches two of them at once.
    expect(plan.transfers).toHaveLength(4);
    expect(total(plan.transfers)).toBe(1200);
  });
});
