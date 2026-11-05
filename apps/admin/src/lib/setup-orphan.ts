/**
 * Setup orphan recovery (bugfix): a failed install can leave the Auth user
 * behind without a profile. While the instance is still uninstalled that user
 * is an orphan and the wizard may delete it and retry. A real account (with a
 * profile) is never touched, and nothing is deleted once setup is complete.
 */
export interface ExistingAuthUser {
  id: string;
  hasProfile: boolean;
  /** A user that has signed in is a real account, never an orphan. */
  hasSignedIn: boolean;
}

/** True when the "already registered" error can be recovered by deleting an orphan. */
export function isRecoverableOrphan(
  errorMessage: string,
  existing: ExistingAuthUser | null,
  setupOpen: boolean,
): boolean {
  return (
    /already been registered/i.test(errorMessage) &&
    existing !== null &&
    !existing.hasProfile &&
    !existing.hasSignedIn &&
    setupOpen
  );
}
