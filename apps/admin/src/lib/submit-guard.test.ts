import { describe, expect, it, vi } from "vitest";
import { submitInvite } from "./invite-submit";
import { submitOnce } from "./submit-guard";

const VALID = {
  token: "027_inv_abc123",
  email: "ana@example.com",
  password: "correct horse battery",
  confirmation: "correct horse battery",
};

describe("submitOnce", () => {
  it("sends a single request when two submits land in the same tick", async () => {
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const fetcher = vi.fn(async () => {
      await gate;
      return new Response("{}", {
        status: 201,
        headers: { "content-type": "application/json" },
      });
    });
    const inFlight = { current: false };

    const first = submitOnce(inFlight, () => submitInvite(VALID, { fetcher }));
    const second = submitOnce(inFlight, () => submitInvite(VALID, { fetcher }));
    release?.();
    await Promise.all([first, second]);

    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("releases the lock after a failure so the user can retry", async () => {
    const fetcher = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });
    const inFlight = { current: false };

    await submitOnce(inFlight, () => submitInvite(VALID, { fetcher }));
    expect(inFlight.current).toBe(false);

    await submitOnce(inFlight, () => submitInvite(VALID, { fetcher }));
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
