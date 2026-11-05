/**
 * Server-side translation loader.
 *
 * Fetches translations from the database for a given locale
 * and returns them as a Map for the t() runtime function.
 */

import type { QueryClient } from "@027apps/core/api/rate-limit-storage.js";

export interface TranslationRow {
  text_en: string;
  translated_text: string;
}

/**
 * Load translations from the database for a locale.
 *
 * @param db - Database client
 * @param locale - The locale to load
 * @returns A Map of text_en → translated_text
 */
export async function loadTranslations(
  db: QueryClient,
  locale: string
): Promise<Map<string, string>> {
  const { rows } = await db.query(
    "select text_en, translated_text from public.translations where locale = $1",
    [locale]
  );

  const map = new Map<string, string>();
  for (const row of rows as unknown as TranslationRow[]) {
    map.set(row.text_en, row.translated_text);
  }
  return map;
}

/**
 * Get the default locale for an instance.
 *
 * Falls back to 'en' if not configured.
 */
export async function getDefaultLocale(
  db: QueryClient
): Promise<string> {
  const { rows } = await db.query(
    "select value from public.settings where key = 'localization.default_locale'"
  );
  if (rows[0]?.value) {
    try {
      const parsed = JSON.parse(rows[0].value as string);
      if (typeof parsed === "string") {
        return parsed;
      }
    } catch {
      // Keep default
    }
  }
  return "en";
}
