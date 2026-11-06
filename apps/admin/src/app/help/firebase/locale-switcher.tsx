"use client";

import type { Locale } from "@027apps/i18n/types.js";
import { LocaleSwitcher } from "@/components/locale-switcher";

export function HelpLocaleSwitcher({ locale, label }: { locale: Locale; label: string }) {
  return (
    <LocaleSwitcher
      locale={locale}
      label={label}
      onChangePath={(next) => `/help/firebase?lang=${next}`}
    />
  );
}
