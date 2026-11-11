"use client";

import { useEffect } from "react";
import type { Locale } from "@027apps/i18n/types.js";

/**
 * Keeps the locale cookie and `<html lang>` in step with the landing route.
 *
 * The landing is static and the language is part of the URL, but the root
 * layout renders `lang="en"` for every route. This runs after hydration; the
 * blocking script in the root layout reads the cookie before paint on the next
 * visit. The cookie is what makes the panel open in the language the visitor
 * just chose. Without JavaScript the links still serve the translated page.
 */
export function LocaleSync({ locale }: { locale: Locale }) {
  useEffect(() => {
    document.cookie = `027_locale=${locale}; Path=/; SameSite=Lax; Max-Age=31536000`;
    document.documentElement.lang = locale;
  }, [locale]);

  return null;
}
