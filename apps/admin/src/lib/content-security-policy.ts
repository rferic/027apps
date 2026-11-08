/**
 * Content-Security-Policy of the panel.
 *
 * Two policies coexist, and they differ on purpose:
 *
 * - `enforcedCsp` is the policy the browser actually applies. It is pragmatic:
 *   it pins every source to our own origin (scripts, frames, forms, connections,
 *   images, fonts) and still allows inline scripts and styles, because with Cache
 *   Components each route prerenders a static shell whose inline scripts cannot
 *   carry a per-request nonce.
 * - `strictReportOnlyCsp` is the nonce-based policy we want. It travels only as
 *   `Content-Security-Policy-Report-Only`, so violations show up in the browser
 *   console without blocking anything: it is the observation track.
 *
 * Hardening the enforced policy (dropping `'unsafe-inline'`) requires removing
 * the prerendered shells first. Reference:
 * `next/dist/docs/01-app/02-guides/content-security-policy.md`.
 */

/**
 * Pragmatic policy the browser enforces: same-origin everywhere, no plugins,
 * no framing, no foreign form targets. Inline scripts and styles stay allowed
 * because the prerendered shells emit them without a nonce.
 *
 * `'unsafe-eval'` is added in development only: React uses `eval()` there to
 * rebuild callstacks, and without it the error overlay warns on every page.
 *
 * `upgrade-insecure-requests` is added outside development only: locally the
 * panel is served over plain http and the directive would break every request.
 */
export function enforcedCsp(isDev: boolean): string {
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "manifest-src 'self'",
  ];
  if (!isDev) directives.push("upgrade-insecure-requests");
  return `${directives.join("; ")};`;
}

/**
 * Current nonce-based policy, served report-only. `'unsafe-eval'` is added in
 * development because the dev bundler needs it; the Supabase origin is allowed
 * in `connect-src` for the auth flows.
 */
export function strictReportOnlyCsp(nonce: string, isDev: boolean): string {
  const origin = supabaseOrigin();
  return `
    default-src 'self';
    script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""};
    style-src 'self' 'nonce-${nonce}';
    img-src 'self' blob: data:;
    font-src 'self';
    connect-src 'self'${origin ? ` ${origin}` : ""};
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';
    upgrade-insecure-requests;
`
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** Origin of the Supabase project, allowed in `connect-src` for auth flows. */
function supabaseOrigin(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}
