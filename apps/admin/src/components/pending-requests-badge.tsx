"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { t } from "@027apps/i18n/t.js";
import type { TranslationMap } from "@027apps/i18n/types.js";
import { fetchPendingRequestCount } from "@/lib/invitation-request-mutations";

const POLL_INTERVAL_MS = 60_000;

export interface PendingPollingDeps {
  fetchCount: () => Promise<number>;
  intervalMs: number;
  isVisible: () => boolean;
  onCount: (count: number) => void;
}

/**
 * The polling contract the badge runs: poll once on start, every `intervalMs`
 * while the tab is visible, and again on focus. No browser Supabase client and
 * no new realtime transport (spec §10) — a plain `fetch` to the pending list.
 * Extracted from the component so the timing is testable without a DOM.
 */
export function startPendingPolling(deps: PendingPollingDeps): () => void {
  const { fetchCount, intervalMs, isVisible, onCount } = deps;
  let stopped = false;

  async function poll() {
    if (!isVisible()) return;
    try {
      const count = await fetchCount();
      if (!stopped) onCount(count);
    } catch {
      // A failed poll just waits for the next tick.
    }
  }

  void poll();
  const interval = setInterval(() => void poll(), intervalMs);
  const onFocus = () => void poll();
  window.addEventListener("focus", onFocus);

  return () => {
    stopped = true;
    clearInterval(interval);
    window.removeEventListener("focus", onFocus);
  };
}

/**
 * Live pending-request counter. It renders a link to `/panel/requests` and,
 * only once the first poll reports a non-zero count, a numeric badge. It sits
 * on the dashboard header (the mockup's nav count), not on a page of its own.
 */
export function PendingRequestsBadge({ messages }: { messages: TranslationMap }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    return startPendingPolling({
      fetchCount: fetchPendingRequestCount,
      intervalMs: POLL_INTERVAL_MS,
      isVisible: () => document.visibilityState === "visible",
      onCount: setCount,
    });
  }, []);

  return (
    <Link
      href="/panel/requests"
      className="inline-flex min-h-11 items-center gap-2 rounded-control border border-border bg-surface px-3 text-xs font-semibold text-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      {t("Requests", messages)}
      {count > 0 && (
        <span
          aria-label={t("{count} pending request(s)", messages, { count })}
          className="inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-primary-foreground"
        >
          {count}
        </span>
      )}
    </Link>
  );
}
