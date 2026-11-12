export interface PreferenceChange<T> {
  next: T;
  previous: T;
  /** Applies the value to the UI and its cookie/class side effects. */
  apply: (value: T) => void;
  /** Persists the value; omitted when there is no signed-in profile. */
  persist?: () => Promise<{ ok: boolean }>;
}

/**
 * Optimistic preference change: apply immediately, persist in the background
 * and roll the UI back to the previous value when the write fails.
 */
export async function applyPreference<T>({
  next,
  previous,
  apply,
  persist,
}: PreferenceChange<T>): Promise<boolean> {
  apply(next);
  if (!persist) return true;

  const result = await persist();
  if (result.ok) return true;

  apply(previous);
  return false;
}
