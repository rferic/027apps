/**
 * Routes that must render without Supabase or a session.
 *
 * Help is an explicit allowlist so adding a page under `/help/` never
 * publishes it by accident. Invitations need a pattern instead: the token is
 * dynamic, but only one segment is ever a page (`/invite/<token>`).
 */
const PUBLIC_HELP_PATHS = new Set(["/help", "/help/firebase"]);

/** Product pages: public and Supabase-free. */
const PUBLIC_PAGES = new Set(["/", "/self-host", "/cookies", "/robots.txt", "/sitemap.xml"]);

const INVITE_PATH = /^\/invite\/([^/]+)$/;

export function isPublicPath(pathname: string): boolean {
  const normalized = pathname.replace(/\/+$/, "") || "/";
  if (PUBLIC_PAGES.has(normalized)) return true;
  if (PUBLIC_HELP_PATHS.has(normalized)) return true;

  const invite = INVITE_PATH.exec(normalized);
  if (!invite) return false;
  const segment = invite[1];
  return segment !== "." && segment !== "..";
}
