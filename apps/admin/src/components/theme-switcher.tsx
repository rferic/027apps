"use client";

import { useState } from "react";
import { t } from "@027apps/i18n/t.js";
import type { TranslationMap } from "@027apps/i18n/types.js";
import { Select } from "@/components/ui/select";
import { patchMember } from "@/lib/member-mutations";
import { applyTheme, themeCookie, themeFromCookie, type Theme } from "@/lib/theme";

const OPTIONS: Theme[] = ["system", "light", "dark"];

/** Literal keys so `i18n:scan` sees every option label. */
function optionLabel(theme: Theme, messages: TranslationMap): string {
  if (theme === "light") return t("Light", messages);
  if (theme === "dark") return t("Dark", messages);
  return t("Automatic", messages);
}

/**
 * Global preference: writes the cookie and applies the class immediately. The
 * server passes the stored value so the control never flashes the wrong option.
 */
export function ThemeSwitcher({
  messages,
  theme: initialTheme = "system",
  userId,
  className,
}: {
  messages: TranslationMap;
  theme?: Theme;
  /** Signed-in profile: the choice is persisted there, not only in the cookie. */
  userId?: string;
  className?: string;
}) {
  const [theme, setTheme] = useState<Theme>(initialTheme);

  async function change(value: string) {
    const previous = theme;
    const next = themeFromCookie(value);
    setTheme(next);
    document.cookie = themeCookie(next);
    applyTheme(document.documentElement, next);
    if (!userId) return;

    // The profile is the source of truth: a failed write reverts the UI.
    const result = await patchMember(userId, { theme: next });
    if (!result.ok) {
      setTheme(previous);
      document.cookie = themeCookie(previous);
      applyTheme(document.documentElement, previous);
    }
  }

  return (
    <Select
      aria-label={t("Theme", messages)}
      title={t("Follows your device setting.", messages)}
      value={theme}
      onChange={(event) => void change(event.target.value)}
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
