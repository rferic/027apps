export const THEME_COOKIE = "027_theme";

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
