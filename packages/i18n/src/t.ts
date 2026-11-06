import type { TranslationMap } from "./types.js";

/**
 * Runtime translation: the English text is the key, so a missing translation
 * falls back to the English text itself. The server resolves the map; the
 * client never interprets the result as HTML.
 *
 * `params` interpolates `{name}` placeholders. A missing parameter keeps the
 * placeholder instead of rendering `undefined`.
 */
export function t(
  text: string,
  map?: TranslationMap | null,
  params?: Record<string, string | number>,
): string {
  const resolved = map?.[text] ?? text;
  if (!params) return resolved;
  return resolved.replace(/\{([^{}]+)\}/g, (match, name: string) => {
    const value = params[name];
    return value === undefined ? match : String(value);
  });
}
