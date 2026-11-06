import type { Locale, TranslationMap } from "@027apps/i18n/types.js";
import { getInfra } from "@/lib/api/door";

/**
 * Panel translations straight from the database: the layout renders on the
 * server, and a self-call to `/api/v1/translations` would need an absolute
 * origin to build. English is the catalog itself, so it needs no map.
 */
export async function loadPanelMessages(locale: Locale): Promise<TranslationMap> {
  if (locale === "en") return {};

  const { settingsDeps } = await getInfra();
  try {
    const { rows } = await settingsDeps.db.query(
      "select text_en, translated_text from public.translations where locale = $1",
      [locale],
    );
    const messages: TranslationMap = {};
    for (const row of rows) {
      messages[String(row.text_en)] = String(row.translated_text);
    }
    return messages;
  } catch {
    // Deliberate degradation: the panel stays usable in English when the
    // translation table is unreachable.
    return {};
  }
}
