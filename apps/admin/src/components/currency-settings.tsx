"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { t } from "@027apps/i18n/t.js";
import type { Locale, TranslationMap } from "@027apps/i18n/types.js";
import { Button } from "@/components/ui/button";
import { MultiSelect, type MultiSelectOption } from "@/components/ui/multi-select";
import {
  applyCurrencyChanges,
  bulkDisableChanges,
  currencyOptions,
  type CurrencyChange,
} from "@/lib/currency-options";
import type { MutationFailure } from "@/lib/mutation-result";
import { panelErrorCodeLabel } from "@/lib/panel-errors";
import type { CurrencyRow } from "@/lib/setting-types";

function CurrencyRowError({
  code,
  error,
  messages,
}: {
  code: string;
  error: MutationFailure;
  messages: TranslationMap;
}) {
  return (
    <div role="alert" className="rounded-control border border-destructive p-2 text-xs">
      <p className="font-semibold text-destructive">
        {t("We couldn't change the currency.", messages)} <span className="font-mono">{code}</span>
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
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, MutationFailure>>({});
  const [confirmingBulk, setConfirmingBulk] = useState(false);

  const options = useMemo<MultiSelectOption[]>(
    () =>
      currencyOptions(currencies, locale).map((currency) => ({
        value: currency.code,
        label: `${currency.symbol} · ${currency.name}`,
        hint: currency.code,
        fixed: currency.isDefault,
      })),
    [currencies, locale],
  );
  const values = useMemo(
    () => currencies.filter((currency) => currency.enabled).map((currency) => currency.code),
    [currencies],
  );
  const bulkChanges = bulkDisableChanges(currencies);
  const busy = Object.keys(saving).length > 0;
  const pendingValue = Object.keys(saving)[0] ?? null;

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

    // The combobox is controlled by the server props: once the batch ends,
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

  function toggle(code: string) {
    const currency = currencies.find((row) => row.code === code);
    if (!currency || currency.isDefault) return;
    void runChanges([{ code, enabled: !currency.enabled }]);
  }

  const bulkCount = bulkChanges.length;

  return (
    <section className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4">
      <p className="text-xs text-muted-foreground">
        {t("Currencies available to this instance.", messages)}
      </p>

      <MultiSelect
        label={t("Currencies", messages)}
        placeholder={t("Currencies", messages)}
        searchPlaceholder={t("Search by name, code or symbol.", messages)}
        options={options}
        values={values}
        onToggle={toggle}
        onClear={() => setConfirmingBulk(true)}
        pendingValue={pendingValue}
        emptyLabel={t("No currencies match", messages)}
        messages={messages}
        disabled={busy}
      />

      {confirmingBulk && (
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
      )}

      {Object.entries(errors).map(([code, error]) => (
        <CurrencyRowError key={code} code={code} error={error} messages={messages} />
      ))}

      {defaultCode === null && (
        <p className="text-xs text-muted-foreground">
          {t("No default currency is configured.", messages)}
        </p>
      )}
    </section>
  );
}
