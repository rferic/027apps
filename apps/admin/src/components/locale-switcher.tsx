"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SUPPORTED_LOCALES } from "@027apps/core/settings/catalog.js";
import type { Locale } from "@027apps/i18n/types.js";
import { Select } from "@/components/ui/select";
import { LOCALE_LABELS, localeCookie } from "@/lib/locale";
import { patchMember } from "@/lib/member-mutations";
import { applyPreference } from "@/lib/preference-change";

interface LocaleSwitcherProps {
  locale: Locale;
  label: string;
  /** Signed-in profile: the choice is persisted there, not only in the cookie. */
  userId?: string;
  onChangePath?: (locale: Locale) => string;
  className?: string;
}

export function LocaleSwitcher({
  locale,
  label,
  userId,
  onChangePath,
  className,
}: LocaleSwitcherProps) {
  const router = useRouter();
  const [value, setValue] = useState<Locale>(locale);

  async function change(next: Locale) {
    const applied = await applyPreference({
      next,
      previous: value,
      apply: (value) => {
        setValue(value);
        document.cookie = localeCookie(value);
      },
      persist: userId ? () => patchMember(userId, { locale: next }) : undefined,
    });
    if (!applied) return;

    if (onChangePath) router.replace(onChangePath(next));
    else router.refresh();
  }

  return (
    <label className="flex items-center gap-2 text-xs text-muted-foreground">
      <span className="sr-only">{label}</span>
      <Select
        aria-label={label}
        value={value}
        onChange={(event) => void change(event.target.value as Locale)}
        className={className}
      >
        {SUPPORTED_LOCALES.map((supportedLocale) => (
          <option key={supportedLocale} value={supportedLocale}>
            {LOCALE_LABELS[supportedLocale]}
          </option>
        ))}
      </Select>
    </label>
  );
}
