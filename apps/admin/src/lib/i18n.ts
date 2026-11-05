/**
 * Server-side translation loader.
 *
 * Fetches translations from the database for a given locale
 * and returns them as a Map for the t() runtime function.
 */

import type { QueryClient } from "@027apps/core/api/rate-limit-storage.js";

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
  for (const row of rows) {
    map.set(String(row.text_en), String(row.translated_text));
  }
  return map;
}
