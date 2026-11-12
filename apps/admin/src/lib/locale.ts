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

export interface LocaleOption {
  value: Locale;
  /** Native name, so every language is recognizable to its speakers. */
  label: string;
  /** ISO code, shown as the secondary text and matchable by the search. */
  hint: string;
  /** English is mandatory in the Core, so it cannot be removed. */
  fixed: boolean;
}

/** The nine supported locales as multi-select options, in canonical order. */
export function localeOptions(): LocaleOption[] {
  return (Object.keys(LOCALE_LABELS) as Locale[]).map((locale) => ({
    value: locale,
    label: LOCALE_LABELS[locale],
    hint: locale,
    fixed: locale === "en",
  }));
}

export function isSupportedLocale(value: string | null | undefined): value is Locale {
  return value !== null && value !== undefined && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

/** First supported language in an `Accept-Language` header, or English. */
export function localeFromAcceptLanguage(header: string | null | undefined): Locale {
  if (!header) return "en";
  const candidates = header
    .split(",")
    .map((part) => {
      const [tag = "", quality = "1"] = part.trim().split(";q=");
      return { tag: tag.trim().toLowerCase(), quality: Number(quality) || 0 };
    })
    .filter((candidate) => candidate.tag.length > 0)
    .sort((a, b) => b.quality - a.quality);

  for (const { tag } of candidates) {
    const base = tag.split("-")[0];
    if (isSupportedLocale(base)) return base;
  }
  return "en";
}

export function resolveLocale(input: {
  query?: string | null;
  cookie?: string | null;
  acceptLanguage?: string | null;
}): Locale {
  if (isSupportedLocale(input.query)) return input.query;
  if (isSupportedLocale(input.cookie)) return input.cookie;
  return localeFromAcceptLanguage(input.acceptLanguage);
}

export function localeCookie(locale: Locale): string {
  return `${LOCALE_COOKIE}=${locale}; Path=/; SameSite=Lax; Max-Age=31536000`;
}
