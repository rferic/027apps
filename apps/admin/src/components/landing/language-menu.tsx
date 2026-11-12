"use client";

import { useRouter } from "next/navigation";
import { useRef, useTransition } from "react";
import type { Locale } from "@027apps/i18n/types.js";
import { LANDING_LANGUAGES, languageLabel } from "@/lib/landing/i18n";
import { localeCookie } from "@/lib/locale";

/** DOM writes live outside the component so the compiler does not treat them as render mutations. */
function persistLocale(code: Locale) {
  document.cookie = localeCookie(code);
  document.documentElement.lang = code;
}

/**
 * Language picker. The public site has one URL per page, so choosing a
 * language stores the preference in `027_locale` and refreshes the server
 * component; the address does not change.
 */
export function LanguageMenu({ locale, label }: { locale: Locale; label: string }) {
  const router = useRouter();
  const details = useRef<HTMLDetailsElement>(null);
  const [pending, startTransition] = useTransition();

  function choose(code: Locale) {
    persistLocale(code);
    details.current?.removeAttribute("open");
    startTransition(() => router.refresh());
  }

  return (
    <details ref={details} className="lang" data-pending={pending ? "" : undefined}>
      <summary aria-label={label}>{languageLabel(locale)} ▾</summary>
      <div className="lang-menu">
        {LANDING_LANGUAGES.map(({ code, label: name }) => (
          <button
            key={code}
            type="button"
            lang={code}
            aria-current={code === locale ? "true" : undefined}
            onClick={() => choose(code)}
          >
            {name}
          </button>
        ))}
      </div>
    </details>
  );
}
