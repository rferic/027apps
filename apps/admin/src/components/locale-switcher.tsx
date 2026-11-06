"use client";

import { useRouter } from "next/navigation";
import { SUPPORTED_LOCALES } from "@027apps/core/settings/catalog.js";
import type { Locale } from "@027apps/i18n/types.js";
import { cn } from "@/lib/cn";
import { LOCALE_LABELS, localeCookie } from "@/lib/locale";

interface LocaleSwitcherProps {
  locale: Locale;
  label: string;
  onChangePath?: (locale: Locale) => string;
  className?: string;
}

export function LocaleSwitcher({ locale, label, onChangePath, className }: LocaleSwitcherProps) {
  const router = useRouter();

  return (
    <label className="flex items-center gap-2 text-xs text-muted-foreground">
      <span className="sr-only">{label}</span>
      <select
        aria-label={label}
        value={locale}
        onChange={(event) => {
          const next = event.target.value as Locale;
          document.cookie = localeCookie(next);
          if (onChangePath) router.replace(onChangePath(next));
          else router.refresh();
        }}
        className={cn(
          "rounded-control border border-border bg-background px-2.5 py-1.5 text-xs text-foreground",
          className,
        )}
      >
        {SUPPORTED_LOCALES.map((supportedLocale) => (
          <option key={supportedLocale} value={supportedLocale}>
            {LOCALE_LABELS[supportedLocale]}
          </option>
        ))}
      </select>
    </label>
  );
}
