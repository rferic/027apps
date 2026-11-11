"use client";

import { useEffect, useLayoutEffect } from "react";
import { applyTheme, themeCookie, type Theme } from "@/lib/theme";

/** `useLayoutEffect` warns during SSR; fall back to `useEffect` on the server. */
const useIsomorphicLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * Applies the signed-in profile's theme and language to the document.
 *
 * The root layout already applies the cookie theme before paint. This runs
 * before the panel's first paint too, but with the profile values the server
 * just read, so switching account in the same browser recovers that account's
 * appearance. It also re-aligns both cookies for the public pages.
 *
 * A client effect replaces the inline `<script>` the layout used to render:
 * React never executes a script that appears while rendering a component on
 * the client, and it logged a console error on every panel navigation.
 */
export function PanelAppearance({ theme, locale }: { theme: Theme; locale: string }) {
  useIsomorphicLayoutEffect(() => {
    applyTheme(document.documentElement, theme);
    document.documentElement.lang = locale;
    document.cookie = themeCookie(theme);
    document.cookie = `027_locale=${locale}; Path=/; SameSite=Lax; Max-Age=31536000`;
  }, [theme, locale]);

  return null;
}
