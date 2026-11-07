"use client";

import { useState } from "react";
import { t } from "@027apps/i18n/t.js";
import type { TranslationMap } from "@027apps/i18n/types.js";
import { Select } from "@/components/ui/select";
import { applyTheme, themeCookie, themeFromCookie, type Theme } from "@/lib/theme";

const OPTIONS: Theme[] = ["system", "light", "dark"];

/** Literal keys so `i18n:scan` sees every option label. */
function optionLabel(theme: Theme, messages: TranslationMap): string {
  if (theme === "light") return t("Light", messages);
  if (theme === "dark") return t("Dark", messages);
  return t("System", messages);
}

/**
 * Global preference: writes the cookie and applies the class immediately. The
 * server passes the stored value so the control never flashes the wrong option.
 */
export function ThemeSwitcher({
  messages,
  theme: initialTheme = "system",
  className,
}: {
  messages: TranslationMap;
  theme?: Theme;
  className?: string;
}) {
  const [theme, setTheme] = useState<Theme>(initialTheme);

  return (
    <Select
      aria-label={t("Theme", messages)}
      value={theme}
      onChange={(event) => {
        const next = themeFromCookie(event.target.value);
        setTheme(next);
        document.cookie = themeCookie(next);
        applyTheme(document.documentElement, next);
      }}
      className={className}
    >
      {OPTIONS.map((option) => (
        <option key={option} value={option}>
          {optionLabel(option, messages)}
        </option>
      ))}
    </Select>
  );
}
