import type { Locale } from "@027apps/i18n/types.js";

/**
 * Keeps the locale cookie and `<html lang>` in step with the landing route.
 *
 * The landing is static and the language is part of the URL, but the root
 * layout renders `lang="en"` for every route. This blocking script runs while
 * the page parses, so a direct visit to `/l/de` reports German before the
 * first paint (and without waiting for hydration). The cookie is what makes
 * the panel open in the language the visitor just chose.
 */
export function LocaleSync({ locale }: { locale: Locale }) {
  const script = [
    "(function(){try{",
    `document.cookie="027_locale=${locale}; Path=/; SameSite=Lax; Max-Age=31536000";`,
    `document.documentElement.lang=${JSON.stringify(locale)};`,
    "}catch(e){}})();",
  ].join("");

  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
