"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/**
 * Cache Components keeps the client tree alive with React `<Activity>`: leaving
 * the route only hides it, so a form that seeds `useState` from server props
 * keeps its draft when the user comes back, while the server still holds the
 * saved value. The draft then looks applied but was never saved.
 *
 * This hook re-seeds such a form when the route or the server value changes and
 * whenever the route is shown again. The server value is compared with a stable
 * fingerprint so an identical re-render never discards what the user is typing.
 */
const useIsomorphicLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * Stable identity of a server value: two renders with the same content produce
 * the same string, so a server re-render on its own never looks like a change.
 */
export function serverFingerprint(serverValue: unknown): string {
  return JSON.stringify(serverValue) ?? "";
}

export function useResetOnRouteChange(serverValue: unknown, reset: () => void): void {
  const pathname = usePathname();
  // Only used as an effect dependency: the string is what makes a real payload
  // change re-run the guard below. An equal payload keeps the draft intact.
  const fingerprint = serverFingerprint(serverValue);
  const resetRef = useRef(reset);
  const seeded = useRef(false);

  // The callback is rebuilt on every render (it closes over the server props);
  // the ref keeps it current without re-running the guard for identity alone.
  useIsomorphicLayoutEffect(() => {
    resetRef.current = reset;
  });

  useIsomorphicLayoutEffect(() => {
    // First run of this mount: `useState` already seeded from the props.
    if (!seeded.current) {
      seeded.current = true;
      return;
    }
    // A later run means the pathname or the payload changed, or Activity hid
    // the route and is showing it again after a navigation; in both cases the
    // draft must not outlive the visit.
    resetRef.current();
  }, [pathname, fingerprint]);
}
