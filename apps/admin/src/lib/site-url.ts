/**
 * Canonical public origin of the site.
 *
 * The landing is static, so the build cannot read the instance settings; a
 * self-hosted instance sets `NEXT_PUBLIC_SITE_URL` to its own domain. The
 * fallback is the project's public site.
 */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://027apps.ericrf.com").replace(
  /\/+$/,
  "",
);
