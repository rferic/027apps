export const THEME_COOKIE = "027_theme";

/** Locale cookie written by the language switcher (mirrors `LOCALE_COOKIE`). */
const LOCALE_COOKIE = "027_locale";

export const THEMES = ["system", "light", "dark"] as const;

export type Theme = (typeof THEMES)[number];

export function isTheme(value: string | null | undefined): value is Theme {
  return value !== null && value !== undefined && (THEMES as readonly string[]).includes(value);
}

/**
 * Cookie value → theme. A missing or hostile value means "follow the OS": the
 * only accepted values are the three the switcher writes.
 */
export function themeFromCookie(value: string | null | undefined): Theme {
  return isTheme(value) ? value : "system";
}

/** Non-session preference cookie; the client writes it, so it is not HttpOnly. */
export function themeCookie(theme: Theme): string {
  return `${THEME_COOKIE}=${theme}; Path=/; SameSite=Lax; Max-Age=31536000`;
}

/** Reads one cookie out of a `document.cookie` string. */
export function cookieValue(cookie: string, name: string): string | null {
  for (const part of cookie.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name && rest.length > 0) return rest.join("=");
  }
  return null;
}

/**
 * What the theme override writes on the document root. Extracted from the DOM
 * so the mapping is testable without a browser.
 */
export interface ThemeRoot {
  classList: { toggle(name: string, force?: boolean): void };
  style: { colorScheme: string };
}

/**
 * Explicit classes are what force a theme against the OS; `system` removes both
 * and lets `prefers-color-scheme` in design-tokens.css decide.
 */
export function applyTheme(root: ThemeRoot, theme: Theme): void {
  root.classList.toggle("dark", theme === "dark");
  root.classList.toggle("light", theme === "light");
  root.style.colorScheme = theme === "system" ? "" : theme;
}

/**
 * Inline script that applies the stored theme before the first paint.
 *
 * `DocumentTheme` used a `useEffect`, which runs after hydration: a browser
 * whose OS is light and whose cookie says dark painted light first. This string
 * is rendered as a blocking script at the top of `<body>`, so the class is set
 * before any content paints and the page never flashes.
 *
 * The `lang` attribute follows the locale cookie only when the URL does not
 * carry `?lang` (the public help page lets the query override the cookie).
 */
export function themeBootstrapScript(): string {
  return [
    "(function(){try{",
    `var m=document.cookie.match(/(?:^|; )${THEME_COOKIE}=(dark|light)(?:;|$)/);`,
    "var t=m?m[1]:null;var r=document.documentElement;",
    'r.classList.toggle("dark",t==="dark");',
    'r.classList.toggle("light",t==="light");',
    'r.style.colorScheme=t||"";',
    "if(!/[?&]lang=/.test(window.location.search)){",
    `var l=document.cookie.match(/(?:^|; )${LOCALE_COOKIE}=([a-z]{2})(?:;|$)/);`,
    "if(l){r.lang=l[1];}",
    "}",
    "}catch(e){}})();",
  ].join("");
}

/**
 * Panel script: the profile's theme wins over the cookie.
 *
 * The root layout applies the cookie before the first paint; this runs later in
 * the same paint, once the server knows the signed-in profile, so changing user
 * in the same browser recovers that account's appearance. It also re-aligns the
 * cookies for the public pages (login, invitation, help).
 */
export function panelThemeScript(theme: Theme, locale: string): string {
  const themeCookieValue = `${THEME_COOKIE}=${theme}; Path=/; SameSite=Lax; Max-Age=31536000`;
  const localeCookieValue = `${LOCALE_COOKIE}=${locale}; Path=/; SameSite=Lax; Max-Age=31536000`;
  return [
    "(function(){try{",
    "var r=document.documentElement;",
    `r.classList.toggle("dark",${theme === "dark"});`,
    `r.classList.toggle("light",${theme === "light"});`,
    `r.style.colorScheme=${JSON.stringify(theme === "system" ? "" : theme)};`,
    `r.lang=${JSON.stringify(locale)};`,
    `document.cookie=${JSON.stringify(themeCookieValue)};`,
    `document.cookie=${JSON.stringify(localeCookieValue)};`,
    "}catch(e){}})();",
  ].join("");
}
