import { cache } from "react";
import type { LogEntry } from "@027apps/core/api/types.js";
import { getDictionary } from "@027apps/i18n/dictionary.js";
import type { Locale, TranslationMap } from "@027apps/i18n/types.js";
import { getInfra } from "@/lib/api/door";

/**
 * The repo dictionaries are the source of truth; `translations` only carries
 * runtime edits. It may be empty (or unreachable), so overlaying its rows on
 * the bundled map keeps all nine locales available from the first request.
 */
export const loadPanelMessages = cache(async (locale: Locale): Promise<TranslationMap> => {
  const base = getDictionary(locale);
  let logger: ((entry: LogEntry) => void) | undefined;

  try {
    const infra = await getInfra();
    logger = infra.deps.logger;
    const { rows } = await infra.settingsDeps.db.query(
      "select text_en, translated_text from public.translations where locale = $1",
      [locale],
    );
    const overrides: TranslationMap = {};
    for (const row of rows) {
      overrides[String(row.text_en)] = String(row.translated_text);
    }
    return { ...base, ...overrides };
  } catch {
    // Deliberate degradation: the panel stays readable with the packaged map.
    logger?.({
      level: "warn",
      requestId: "panel-i18n",
      message: "panel translations unavailable; falling back to the bundled dictionary",
    });
    return base;
  }
});
