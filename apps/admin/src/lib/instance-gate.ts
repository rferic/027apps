/**
 * Entry gate: decides which page a browser may open, from the instance state
 * and the session. Kept pure so it is testable without Next or the database.
 *
 * The proxy applies it before rendering because a `redirect()` thrown inside a
 * dynamic page renders after the shell has been flushed, which answers 200
 * (blank error shell) instead of a 307 in production.
 */
export interface GateState {
  /** An active super_admin exists: the creation window (steps 1–2) is closed. */
  installed: boolean;
  /** An admin exists but `instance.public_url` / `localization.*` are missing. */
  setupIncomplete: boolean;
  /** The request carries a signed-in Supabase session. */
  hasSession: boolean;
}

const SETUP_PATH = "/setup";
const LOGIN_PATH = "/login";
const PANEL_PATH = "/";

/** Target path to redirect to, or `null` when the request may proceed. */
export function entryGate(pathname: string, state: GateState): string | null {
  if (pathname === SETUP_PATH) {
    // Steps 1–2 happen without a session; steps 3–5 need the super_admin's.
    if (!state.installed) return null;
    if (!state.hasSession) return LOGIN_PATH;
    // The wizard disappears when the instance is fully configured (§7.3).
    return state.setupIncomplete ? null : PANEL_PATH;
  }

  if (pathname === LOGIN_PATH) {
    return state.installed ? null : SETUP_PATH;
  }

  if (pathname === PANEL_PATH) {
    if (!state.installed) return SETUP_PATH;
    return state.hasSession ? null : LOGIN_PATH;
  }

  return null;
}
