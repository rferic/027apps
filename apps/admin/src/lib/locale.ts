import { SUPPORTED_LOCALES } from "@027apps/core/settings/catalog.js";
import type { Locale } from "@027apps/i18n/types.js";

export const LOCALE_COOKIE = "027_locale";

export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  es: "Español",
  ca: "Català",
  it: "Italiano",
  fr: "Français",
  de: "Deutsch",
  pt: "Português",
  gl: "Galego",
  eu: "Euskara",
};

export function isSupportedLocale(value: string | null | undefined): value is Locale {
  return value !== null && value !== undefined && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

export function resolveLocale(input: { query?: string | null; cookie?: string | null }): Locale {
  if (isSupportedLocale(input.query)) return input.query;
  if (isSupportedLocale(input.cookie)) return input.cookie;
  return "en";
}

export function localeCookie(locale: Locale): string {
  return `${LOCALE_COOKIE}=${locale}; Path=/; SameSite=Lax; Max-Age=31536000`;
}
