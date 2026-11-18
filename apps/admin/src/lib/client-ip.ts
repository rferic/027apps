/**
 * The client's address, with the same precedence the API door uses.
 *
 * `x-real-ip` (and Vercel's own header) win because a reverse proxy rewrites
 * them; `x-forwarded-for` is the last resort, since its first element is
 * attacker-controlled when nothing rewrites the header. Reading it first, as
 * the pages used to, let anyone rotate a fake address and skip the per-IP
 * budget — on password recovery that is a mail-flood lever.
 */
export interface HeaderReader {
  get(name: string): string | null;
}

const first = (value: string | null): string =>
  value?.split(",")[0]?.trim() ?? "";

export function clientIp(requestHeaders: HeaderReader): string {
  const real = first(requestHeaders.get("x-real-ip"));
  if (real) return real;
  const vercel = first(requestHeaders.get("x-vercel-forwarded-for"));
  if (vercel) return vercel;
  const forwarded = first(requestHeaders.get("x-forwarded-for"));
  return forwarded.length > 0 ? forwarded : "unknown";
}
