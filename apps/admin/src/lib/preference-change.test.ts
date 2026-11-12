import { describe, expect, it, vi } from "vitest";
import { applyPreference } from "./preference-change";

describe("applyPreference", () => {
  it("applies immediately when there is nothing to persist", async () => {
    const apply = vi.fn();
    const persist = vi.fn();

    await expect(
      applyPreference({ next: "dark", previous: "light", apply, persist: undefined }),
    ).resolves.toBe(true);

    expect(apply).toHaveBeenCalledWith("dark");
    expect(persist).not.toHaveBeenCalled();
  });

  it("keeps the new value when the write succeeds", async () => {
    const apply = vi.fn();
    const persist = vi.fn(async () => ({ ok: true }));

    await expect(
      applyPreference({ next: "dark", previous: "light", apply, persist }),
    ).resolves.toBe(true);

    expect(apply).toHaveBeenCalledTimes(1);
    expect(apply).toHaveBeenCalledWith("dark");
  });

  it("rolls the UI back when the write fails", async () => {
    const apply = vi.fn();
    const persist = vi.fn(async () => ({ ok: false }));

    await expect(
      applyPreference({ next: "dark", previous: "light", apply, persist }),
    ).resolves.toBe(false);

    expect(apply).toHaveBeenNthCalledWith(1, "dark");
    expect(apply).toHaveBeenNthCalledWith(2, "light");
  });
});
