"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { t } from "@027apps/i18n/t.js";
import type { TranslationMap } from "@027apps/i18n/types.js";
import { Badge } from "@/components/ui/badge";
import { setCurrencyEnabled } from "@/lib/currency-mutations";
import type { MutationFailure } from "@/lib/mutation-result";
import { panelErrorCodeLabel } from "@/lib/panel-errors";
import type { CurrencyRow } from "@/lib/setting-types";

function CurrencyError({ error, messages }: { error: MutationFailure; messages: TranslationMap }) {
  return (
    <div role="alert" className="rounded-card border border-destructive p-3 text-xs">
      <p className="font-semibold text-destructive">
        {t("We couldn't change the currency.", messages)}
      </p>
      {error.code && (
        <p className="mt-1 text-muted-foreground">{panelErrorCodeLabel(error.code, messages)}</p>
      )}
      {error.requestId && (
        <p className="mt-1 text-muted-foreground">
          {t("Request ID", messages)}: <code className="select-all font-mono">{error.requestId}</code>
        </p>
      )}
    </div>
  );
}

/**
 * Enable/disable currencies. The default comes from the API (`isDefault`) and
 * the Core refuses to disable it; the control is rendered disabled with the
 * reason rather than hidden, so the state is understandable without the API.
 */
export function CurrencySettings({
  defaultCode,
  currencies,
  messages,
}: {
  defaultCode: string | null;
  currencies: CurrencyRow[];
  messages: TranslationMap;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<MutationFailure | null>(null);

  async function toggle(code: string, enabled: boolean) {
    setPending(code);
    setError(null);
    const result = await setCurrencyEnabled(code, enabled);
    setPending(null);
    if (!result.ok) {
      setError(result);
      return;
    }
    router.refresh();
  }

  return (
    <section className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-sm font-semibold">{t("Currencies", messages)}</h2>
        <p className="text-xs text-muted-foreground">
          {t("Currencies available to this instance.", messages)}
        </p>
      </div>

      <ul className="flex flex-col divide-y divide-border">
        {currencies.map((currency) => (
          <li key={currency.code} className="flex min-h-11 flex-wrap items-center gap-2 py-2">
            <label className="flex min-h-11 items-center gap-2 text-xs font-semibold">
              <input
                id={`currency-${currency.code}`}
                type="checkbox"
                checked={currency.enabled}
                disabled={currency.isDefault || pending === currency.code}
                aria-describedby={
                  currency.isDefault ? `currency-${currency.code}-default` : undefined
                }
                onChange={(event) => void toggle(currency.code, event.target.checked)}
              />
              <span className="font-mono">{currency.code}</span>
            </label>
            {currency.isDefault && <Badge variant="success">{t("Default", messages)}</Badge>}
            <Badge variant={currency.enabled ? "neutral" : "destructive"}>
              {currency.enabled ? t("Enabled", messages) : t("Disabled", messages)}
            </Badge>
            {currency.isDefault && (
              <span id={`currency-${currency.code}-default`} className="text-xs text-muted-foreground">
                {t("The default currency cannot be disabled.", messages)}
              </span>
            )}
          </li>
        ))}
      </ul>

      {defaultCode === null && (
        <p className="text-xs text-muted-foreground">
          {t("No default currency is configured.", messages)}
        </p>
      )}

      {error && <CurrencyError error={error} messages={messages} />}
    </section>
  );
}
