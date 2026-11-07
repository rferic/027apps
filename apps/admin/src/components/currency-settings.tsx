"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { t } from "@027apps/i18n/t.js";
import type { Locale, TranslationMap } from "@027apps/i18n/types.js";
import { Button } from "@/components/ui/button";
import {
  applyCurrencyChanges,
  bulkDisableChanges,
  currencyLabel,
  currencyOptions,
  enabledCount,
  filterCurrencies,
  type CurrencyChange,
} from "@/lib/currency-options";
import type { MutationFailure } from "@/lib/mutation-result";
import { panelErrorCodeLabel } from "@/lib/panel-errors";
import type { CurrencyRow } from "@/lib/setting-types";

const inputClass =
  "min-h-11 w-full rounded-control border border-border bg-background px-2.5 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

function CurrencyRowError({
  error,
  messages,
}: {
  error: MutationFailure;
  messages: TranslationMap;
}) {
  return (
    <div role="alert" className="rounded-control border border-destructive p-2 text-xs">
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
 * Multi-select currency picker. The database stores only `code`, `enabled` and
 * `isDefault`, so the visible name and symbol are derived from Intl with the
 * UI locale. Each toggle is its own PATCH; a batch refreshes once at the end.
 */
export function CurrencySettings({
  defaultCode,
  currencies,
  locale,
  messages,
}: {
  defaultCode: string | null;
  currencies: CurrencyRow[];
  locale: Locale;
  messages: TranslationMap;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, MutationFailure>>({});
  const [confirmingBulk, setConfirmingBulk] = useState(false);

  const options = useMemo(() => currencyOptions(currencies, locale), [currencies, locale]);
  const filtered = useMemo(() => filterCurrencies(options, query), [options, query]);
  const count = enabledCount(currencies);
  const bulkChanges = bulkDisableChanges(currencies);
  const busy = Object.keys(saving).length > 0;

  async function runChanges(changes: CurrencyChange[]) {
    if (changes.length === 0) return;

    const codes = changes.map((change) => change.code);
    setSaving((current) => {
      const next = { ...current };
      for (const code of codes) next[code] = true;
      return next;
    });
    setErrors((current) => {
      const next = { ...current };
      for (const code of codes) delete next[code];
      return next;
    });

    // The checkboxes are controlled by the server props: once the batch ends,
    // the refresh brings the authoritative enabled flags back.
    const results = await applyCurrencyChanges(changes);
    const failures: Record<string, MutationFailure> = {};
    for (const entry of results) {
      if (!entry.result.ok) failures[entry.code] = entry.result;
    }
    setErrors((current) => ({ ...current, ...failures }));
    setSaving((current) => {
      const next = { ...current };
      for (const code of codes) delete next[code];
      return next;
    });
    router.refresh();
  }

  function toggle(code: string, enabled: boolean) {
    void runChanges([{ code, enabled }]);
  }

  const bulkCount = bulkChanges.length;

  return (
    <fieldset className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4">
      <legend className="text-sm font-semibold">{t("Currencies", messages)}</legend>
      <p className="text-xs text-muted-foreground">
        {t("Currencies available to this instance.", messages)}
      </p>

      <div className="flex flex-col gap-1">
        <label htmlFor="currency-search" className="text-xs font-semibold">
          {t("Search currencies", messages)}
        </label>
        <input
          id="currency-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          aria-describedby="currency-search-hint currency-count"
          className={inputClass}
        />
        <p id="currency-search-hint" className="text-xs text-muted-foreground">
          {t("Search by name, code or symbol.", messages)}
        </p>
        <p id="currency-count" aria-live="polite" className="text-xs font-semibold text-foreground">
          {t("{enabled} of {total} enabled", messages, count)}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {confirmingBulk ? (
          <div role="group" className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-semibold">
              {t("Disable {count} currencies?", messages, { count: bulkCount })}
            </p>
            <Button
              variant="destructive"
              className="min-h-11"
              onClick={() => {
                setConfirmingBulk(false);
                void runChanges(bulkChanges);
              }}
            >
              {t("Confirm", messages)}
            </Button>
            <Button
              variant="secondary"
              className="min-h-11"
              onClick={() => setConfirmingBulk(false)}
            >
              {t("Cancel", messages)}
            </Button>
          </div>
        ) : (
          <Button
            variant="secondary"
            className="min-h-11"
            disabled={bulkCount === 0 || busy}
            onClick={() => setConfirmingBulk(true)}
          >
            {t("Deselect all except the default", messages)}
          </Button>
        )}
      </div>

      {filtered.length === 0 ? (
        <p role="status" className="text-xs text-muted-foreground">
          {t("No currencies match", messages)}
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {filtered.map((currency) => {
            const isSaving = saving[currency.code] === true;
            return (
              <li key={currency.code} className="flex flex-col gap-1 py-1">
                <label className="flex min-h-11 flex-wrap items-center gap-2 text-xs">
                  <input
                    id={`currency-${currency.code}`}
                    type="checkbox"
                    checked={currency.enabled}
                    disabled={currency.isDefault || isSaving}
                    aria-describedby={
                      currency.isDefault ? `currency-${currency.code}-default` : undefined
                    }
                    onChange={(event) => toggle(currency.code, event.target.checked)}
                    className="h-4 w-4 shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  />
                  <span className="font-semibold">{currencyLabel(currency, locale)}</span>
                  {currency.isDefault && (
                    <span
                      id={`currency-${currency.code}-default`}
                      className="text-muted-foreground"
                    >
                      {t("Default currency", messages)}
                    </span>
                  )}
                  {isSaving && (
                    <span role="status" className="text-muted-foreground">
                      {t("Saving…", messages)}
                    </span>
                  )}
                </label>
                {errors[currency.code] && (
                  <CurrencyRowError error={errors[currency.code]} messages={messages} />
                )}
              </li>
            );
          })}
        </ul>
      )}

      {defaultCode === null && (
        <p className="text-xs text-muted-foreground">
          {t("No default currency is configured.", messages)}
        </p>
      )}
    </fieldset>
  );
}
