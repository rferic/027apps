/** Locales of the product set (English is the catalog, not a file). */
export type Locale = "en" | "es" | "ca" | "it" | "fr" | "de" | "pt" | "gl" | "eu";

export const SUPPORTED_LOCALES: readonly Locale[] = [
  "en",
  "es",
  "ca",
  "it",
  "fr",
  "de",
  "pt",
  "gl",
  "eu",
] as const;

/** English text → translated text. */
export type TranslationMap = Record<string, string>;
