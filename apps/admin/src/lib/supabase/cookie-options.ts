import type { CookieOptions } from "@supabase/ssr";

/**
 * `@supabase/ssr` defaults to `httpOnly: false` and does not add `secure`, so
 * the session cookies were readable from client JavaScript. The panel has no
 * browser-side Supabase client: every read goes through the server or the
 * proxy, so the token can stay out of `document.cookie`.
 */
export const SESSION_COOKIE_OPTIONS: CookieOptions = {
  path: "/",
  sameSite: "lax",
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
};
