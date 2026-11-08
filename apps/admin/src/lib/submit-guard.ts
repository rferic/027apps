/**
 * Synchronous double-submit guard. `useState` alone is not enough: two events
 * dispatched before React re-renders both read the old value and each sends a
 * request. The lock lives in a ref, flips before the first `await`, and is
 * released on failure so the user can retry.
 */
export interface InFlightRef {
  current: boolean;
}

export async function submitOnce<T>(
  inFlight: InFlightRef,
  task: () => Promise<T>,
): Promise<T | undefined> {
  if (inFlight.current) return undefined;
  inFlight.current = true;
  try {
    return await task();
  } finally {
    inFlight.current = false;
  }
}
