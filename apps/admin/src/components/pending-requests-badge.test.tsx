import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
}));

import { PendingRequestsBadge, startPendingPolling } from "./pending-requests-badge";

describe("PendingRequestsBadge", () => {
  it("links to the requests inbox and hides the count until the first poll returns", () => {
    const html = renderToStaticMarkup(<PendingRequestsBadge messages={{}} />);

    expect(html).toContain('href="/panel/requests"');
    expect(html).toContain("Requests");
    expect(html).not.toContain('aria-label="1 pending request"');
  });
});

describe("startPendingPolling", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("polls the pending count every 60s and on focus", async () => {
    vi.useFakeTimers();
    const fetchCount = vi.fn().mockResolvedValue(3);
    const onCount = vi.fn();
    const addEventListener = vi.fn();
    const removeEventListener = vi.fn();
    vi.stubGlobal("window", { addEventListener, removeEventListener });
    vi.stubGlobal("document", { visibilityState: "visible" });

    const stop = startPendingPolling({
      fetchCount,
      intervalMs: 60_000,
      isVisible: () => document.visibilityState === "visible",
      onCount,
    });

    expect(fetchCount).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(60_000);
    expect(fetchCount).toHaveBeenCalledTimes(2);

    const focus = addEventListener.mock.calls.find(([event]) => event === "focus")?.[1];
    expect(focus).toBeTypeOf("function");
    focus?.();
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchCount).toHaveBeenCalledTimes(3);

    stop();
    expect(removeEventListener).toHaveBeenCalledWith("focus", focus);
  });

  it("skips a poll while the tab is hidden", async () => {
    vi.useFakeTimers();
    const fetchCount = vi.fn().mockResolvedValue(3);
    const onCount = vi.fn();
    vi.stubGlobal("window", { addEventListener: vi.fn(), removeEventListener: vi.fn() });
    vi.stubGlobal("document", { visibilityState: "hidden" });

    startPendingPolling({
      fetchCount,
      intervalMs: 60_000,
      isVisible: () => document.visibilityState === "visible",
      onCount,
    });

    await vi.advanceTimersByTimeAsync(0);
    expect(fetchCount).not.toHaveBeenCalled();
  });
});
