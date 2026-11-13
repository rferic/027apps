import { beforeEach, describe, expect, it, vi } from "vitest";

// The hook is called from the fake renderer below, not from a component:
// there is no DOM in this test environment (see the harness comment).
/* eslint-disable react-hooks/rules-of-hooks */

/**
 * The admin test environment is plain Node (no DOM), so the hook is exercised
 * with a minimal React hook runtime: refs persist across renders and a layout
 * effect only runs again when its dependencies change, exactly like React.
 * "Show again" models React `<Activity>` re-running the effects when a hidden
 * route becomes visible.
 */
const runtime = vi.hoisted(() => {
  interface EffectSlot {
    deps?: readonly unknown[];
    run: () => void;
  }

  let cursor = 0;
  let pathname = "/panel/settings/instance";
  const refs: Array<{ current: unknown }> = [];
  const slots: EffectSlot[] = [];
  let pending: Array<() => void> = [];

  function sameDeps(a: readonly unknown[] | undefined, b: readonly unknown[] | undefined) {
    if (!a || !b) return false;
    return a.length === b.length && a.every((value, index) => Object.is(value, b[index]));
  }

  return {
    setPathname(next: string) {
      pathname = next;
    },
    getPathname() {
      return pathname;
    },
    beginRender() {
      cursor = 0;
    },
    flush() {
      const batch = pending;
      pending = [];
      for (const run of batch) run();
    },
    showAgain() {
      // Activity recreates every effect when the route becomes visible again.
      for (const slot of slots) slot?.run();
    },
    clear() {
      cursor = 0;
      pathname = "/panel/settings/instance";
      refs.length = 0;
      slots.length = 0;
      pending = [];
    },
    hooks: {
      useRef<T>(initial: T) {
        const index = cursor++;
        refs[index] ??= { current: initial };
        return refs[index] as { current: T };
      },
      useLayoutEffect(run: () => void, deps?: readonly unknown[]) {
        const index = cursor++;
        const slot = slots[index];
        if (slot && sameDeps(slot.deps, deps)) return;
        slots[index] = { deps, run };
        pending.push(run);
      },
      useEffect(run: () => void, deps?: readonly unknown[]) {
        const index = cursor++;
        const slot = slots[index];
        if (slot && sameDeps(slot.deps, deps)) return;
        slots[index] = { deps, run };
        pending.push(run);
      },
    },
  };
});

vi.mock("react", () => ({
  useEffect: runtime.hooks.useEffect,
  useLayoutEffect: runtime.hooks.useLayoutEffect,
  useRef: runtime.hooks.useRef,
}));

vi.mock("next/navigation", () => ({
  usePathname: () => runtime.getPathname(),
}));

import { serverFingerprint, useResetOnRouteChange } from "./use-reset-on-route";

const reset = vi.fn();

function render(serverValue: unknown) {
  runtime.beginRender();
  useResetOnRouteChange(serverValue, reset);
}

function mount(serverValue: unknown) {
  render(serverValue);
  runtime.flush();
}

describe("useResetOnRouteChange", () => {
  beforeEach(() => {
    reset.mockClear();
    runtime.clear();
  });

  it("does not reset the initial hand-off from the server", () => {
    mount({ name: "027Apps" });

    expect(reset).not.toHaveBeenCalled();
  });

  it("keeps the draft while the user types (same route, same data)", () => {
    mount({ name: "027Apps" });

    // Every keystroke re-renders with a new object for the same server value.
    render({ name: "027Apps" });
    render({ name: "027Apps" });
    runtime.flush();

    expect(reset).not.toHaveBeenCalled();
  });

  it("resets when the route changes", () => {
    mount({ name: "027Apps" });

    runtime.setPathname("/panel/settings/localization");
    render({ name: "027Apps" });
    runtime.flush();

    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("resets when the server value changes", () => {
    mount({ name: "027Apps" });

    render({ name: "Renamed" });
    runtime.flush();

    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("resets when the route is shown again after a navigation", () => {
    mount({ name: "027Apps" });

    // Leaving hides the form with Activity, so nothing re-renders it; coming
    // back re-runs the effects with the very same pathname and payload.
    runtime.showAgain();

    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("calls the latest callback, not the one from a previous render", () => {
    const first = vi.fn();
    const second = vi.fn();

    runtime.beginRender();
    useResetOnRouteChange({ name: "027Apps" }, first);
    runtime.flush();

    // A new identity alone must not reset; the stored callback is just updated.
    runtime.beginRender();
    useResetOnRouteChange({ name: "027Apps" }, second);
    runtime.flush();
    expect(first).not.toHaveBeenCalled();

    runtime.showAgain();

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });
});

describe("serverFingerprint", () => {
  it("is stable for equal content", () => {
    expect(serverFingerprint({ name: "027Apps" })).toBe(
      serverFingerprint({ name: "027Apps" }),
    );
  });

  it("changes with the content", () => {
    expect(serverFingerprint({ name: "027Apps" })).not.toBe(
      serverFingerprint({ name: "Renamed" }),
    );
  });

  it("has a value for a missing payload", () => {
    expect(serverFingerprint(undefined)).toBe("");
    expect(serverFingerprint(null)).toBe("null");
  });
});
