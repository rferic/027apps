import { cookies, headers } from "next/headers";
import type { Locale } from "@027apps/i18n/types.js";
import { LOCALE_COOKIE, isSupportedLocale, localeFromAcceptLanguage } from "./locale";

/**
 * Locale for a request: the saved preference wins; otherwise the first
 * supported language in `Accept-Language`; otherwise English.
 *
 * Reading the cookie and the header opts the page out of the static shell.
 * That is the trade-off of resolving the language at one URL. The public
 * pages set `Vary: Cookie, Accept-Language` so no shared cache mixes them.
 */
export async function requestLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(LOCALE_COOKIE)?.value;
  if (isSupportedLocale(cookie)) return cookie;
  const headerStore = await headers();
  return localeFromAcceptLanguage(headerStore.get("accept-language"));
}
