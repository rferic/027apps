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
const PANEL_PATH = "/panel";

/** The wizard: steps 1–2 open, 3–5 need the super_admin, and it closes when done. */
function setupGate(state: GateState): string | null {
  if (!state.installed) return null;
  if (!state.hasSession) return LOGIN_PATH;
  return state.setupIncomplete ? null : PANEL_PATH;
}

/** Login: the wizard first, the panel for a signed-in user. */
function loginGate(state: GateState): string | null {
  if (!state.installed) return SETUP_PATH;
  return state.hasSession ? PANEL_PATH : null;
}

/** Panel: setup first, then a session. */
function panelGate(state: GateState): string | null {
  if (!state.installed) return SETUP_PATH;
  return state.hasSession ? null : LOGIN_PATH;
}

/** Target path to redirect to, or `null` when the request may proceed. */
export function entryGate(pathname: string, state: GateState): string | null {
  if (pathname === SETUP_PATH) return setupGate(state);
  if (pathname === LOGIN_PATH) return loginGate(state);
  if (pathname === PANEL_PATH) return panelGate(state);
  return null;
}
