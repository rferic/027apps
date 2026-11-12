"use client";

import { useState } from "react";
import { t } from "@027apps/i18n/t.js";
import type { TranslationMap } from "@027apps/i18n/types.js";
import { Select } from "@/components/ui/select";
import { patchMember } from "@/lib/member-mutations";
import { applyPreference } from "@/lib/preference-change";
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
    const next = themeFromCookie(value);
    await applyPreference({
      next,
      previous: theme,
      apply: (value) => {
        setTheme(value);
        document.cookie = themeCookie(value);
        applyTheme(document.documentElement, value);
      },
      persist: userId ? () => patchMember(userId, { theme: next }) : undefined,
    });
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
