import type { TranslationMap } from "./types.js";

/**
 * Runtime translation: the English text is the key, so a missing translation
 * falls back to the English text itself. The server resolves the map; the
 * client never interprets the result as HTML.
 */
export function t(text: string, map?: TranslationMap | null): string {
  return map?.[text] ?? text;
}
