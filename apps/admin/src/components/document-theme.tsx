"use client";

import { useEffect } from "react";
import { applyTheme, cookieValue, THEME_COOKIE, themeFromCookie } from "@/lib/theme";

/**
 * Applies the stored theme preference on mount. Without a cookie the document
 * is left untouched, so `prefers-color-scheme` keeps deciding the theme.
 */
export function DocumentTheme() {
  useEffect(() => {
    const stored = cookieValue(document.cookie, THEME_COOKIE);
    if (stored === null) return;
    applyTheme(document.documentElement, themeFromCookie(stored));
  }, []);

  return null;
}
