import type { Locale, TranslationMap } from "./types.js";
import ca from "../locales/ca.json";
import de from "../locales/de.json";
import es from "../locales/es.json";
import eu from "../locales/eu.json";
import fr from "../locales/fr.json";
import gl from "../locales/gl.json";
import it from "../locales/it.json";
import pt from "../locales/pt.json";

/**
 * Dictionaries bundled from the repository catalog. They are the base for
 * every screen, including the authenticated panel, which overlays runtime
 * edits from the seeded `translations` table on top.
 */
const DICTIONARIES: Record<Exclude<Locale, "en">, TranslationMap> = {
  ca,
  de,
  es,
  eu,
  fr,
  gl,
  it,
  pt,
};

export function getDictionary(locale: Locale): TranslationMap {
  if (locale === "en") return {};
  return DICTIONARIES[locale] ?? {};
}
