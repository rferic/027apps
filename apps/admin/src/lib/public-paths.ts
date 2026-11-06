/**
 * Help routes that must render without Supabase or a session. Kept as an
 * explicit allowlist so adding a page under `/help/` never publishes it by
 * accident.
 */
const PUBLIC_HELP_PATHS = new Set(["/help", "/help/firebase"]);

export function isPublicHelpPath(pathname: string): boolean {
  const normalized = pathname.replace(/\/+$/, "") || "/";
  return PUBLIC_HELP_PATHS.has(normalized);
}
