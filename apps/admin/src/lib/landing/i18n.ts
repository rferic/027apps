import { getDictionary } from "@027apps/i18n/dictionary.js";
import { t } from "@027apps/i18n/t.js";
import type { Locale, TranslationMap } from "@027apps/i18n/types.js";

/** Language menu order and labels (each language in its own words). */
export const LANDING_LANGUAGES: readonly { code: Locale; label: string; short: string }[] = [
  { code: "es", label: "Español", short: "ES" },
  { code: "en", label: "English", short: "EN" },
  { code: "ca", label: "Català", short: "CA" },
  { code: "gl", label: "Galego", short: "GL" },
  { code: "eu", label: "Euskara", short: "EU" },
  { code: "pt", label: "Português", short: "PT" },
  { code: "fr", label: "Français", short: "FR" },
  { code: "it", label: "Italiano", short: "IT" },
  { code: "de", label: "Deutsch", short: "DE" },
];

export type LandingPage = "app" | "selfhost" | "cookies";

/** Open Graph locale codes for the nine languages. */
const OG_LOCALES: Record<string, string> = {
  en: "en_US",
  es: "es_ES",
  ca: "ca_ES",
  gl: "gl_ES",
  eu: "eu_ES",
  pt: "pt_PT",
  fr: "fr_FR",
  it: "it_IT",
  de: "de_DE",
};

export function ogLocale(locale: Locale): string {
  return OG_LOCALES[locale] ?? "en_US";
}

/**
 * Path of one landing page. The language lives in the cookie, not the URL,
 * so every language shares the same address.
 */
export function landingHref(_locale: Locale, page: LandingPage): string {
  if (page === "selfhost") return "/self-host";
  if (page === "cookies") return "/cookies";
  return "/";
}

export function languageLabel(locale: Locale): string {
  return LANDING_LANGUAGES.find((language) => language.code === locale)?.short ?? "EN";
}

export function landingMessages(locale: Locale): TranslationMap {
  return getDictionary(locale);
}

/**
 * `t()` bound to one language. The English text is the key, so a missing
 * translation renders English instead of a placeholder.
 */
export function translator(locale: Locale): (text: string) => string {
  const messages = landingMessages(locale);
  return (text: string) => t(text, messages);
}
