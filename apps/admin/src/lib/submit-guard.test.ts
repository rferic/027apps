import { describe, expect, it, vi } from "vitest";
import { submitInvite } from "./invite-submit";
import { submitOnce } from "./submit-guard";

const VALID = {
  token: "027_inv_abc123",
  password: "correct horse battery",
  confirmation: "correct horse battery",
};

describe("submitOnce", () => {
  it("sends a single request when two submits land in the same tick", async () => {
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const submit = vi.fn(async () => {
      await gate;
      return { ok: true as const, role: "admin" as const };
    });
    const inFlight = { current: false };

    const first = submitOnce(inFlight, () => submitInvite(VALID, { submit }));
    const second = submitOnce(inFlight, () => submitInvite(VALID, { submit }));
    release?.();
    await Promise.all([first, second]);

    expect(submit).toHaveBeenCalledTimes(1);
  });

  it("releases the lock after a failure so the user can retry", async () => {
    const submit = vi.fn(async () => ({ ok: false as const, code: "internal" }));
    const inFlight = { current: false };

    await submitOnce(inFlight, () => submitInvite(VALID, { submit }));
    expect(inFlight.current).toBe(false);

    await submitOnce(inFlight, () => submitInvite(VALID, { submit }));
    expect(submit).toHaveBeenCalledTimes(2);
  });
});
