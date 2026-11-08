"use client";

import { useState } from "react";
import { t } from "@027apps/i18n/t.js";
import type { TranslationMap } from "@027apps/i18n/types.js";
import { FieldError } from "@/components/ui/form";
import { Select } from "@/components/ui/select";
import {
  EXPIRY_UNITS,
  MAX_EXPIRY_AMOUNT,
  type ExpiryChoice,
  type ExpiryUnit,
} from "@/lib/api-key-expiry";

const inputClass =
  "min-h-11 w-28 rounded-control border border-border bg-background px-2.5 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50";

const ERROR_ID = "api-key-expiry-amount-error";
const AMOUNT_ID = "api-key-expiry-amount";
const UNIT_ID = "api-key-expiry-unit";

const UNIT_LABEL: Record<ExpiryUnit, (messages: TranslationMap) => string> = {
  hours: (messages) => t("Hours", messages),
  days: (messages) => t("Days", messages),
  months: (messages) => t("Months", messages),
  years: (messages) => t("Years", messages),
};

function amountValue(text: string): number {
  const trimmed = text.trim();
  if (trimmed === "") return 0;
  const value = Number(trimmed);
  return Number.isInteger(value) ? value : 0;
}

/** A mode radio plus the amount and unit, kept mounted so no typing is lost. */
function RelativeControls({
  amountText,
  unit,
  relative,
  error,
  onAmountChange,
  onUnitChange,
  messages,
}: {
  amountText: string;
  unit: ExpiryUnit;
  relative: boolean;
  error?: string;
  onAmountChange: (text: string) => void;
  onUnitChange: (unit: ExpiryUnit) => void;
  messages: TranslationMap;
}) {
  return (
    <div className="flex flex-wrap items-start gap-2 pl-6">
      <input
        id={AMOUNT_ID}
        name="expiry_amount"
        type="number"
        min={1}
        step={1}
        max={MAX_EXPIRY_AMOUNT}
        inputMode="numeric"
        required={relative}
        disabled={!relative}
        value={amountText}
        onChange={(event) => onAmountChange(event.target.value)}
        aria-label={t("Amount", messages)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? ERROR_ID : undefined}
        className={inputClass}
      />
      <Select
        id={UNIT_ID}
        name="expiry_unit"
        value={unit}
        disabled={!relative}
        onChange={(event) => onUnitChange(event.target.value as ExpiryUnit)}
        aria-label={t("Unit", messages)}
        className="w-36"
      >
        {EXPIRY_UNITS.map((entry) => (
          <option key={entry} value={entry}>
            {UNIT_LABEL[entry](messages)}
          </option>
        ))}
      </Select>
    </div>
  );
}

/**
 * Expiry selector shared by the create and edit forms. The three modes are
 * plain `name="expiry_mode"` radios so the form action receives one value; the
 * amount and the unit stay mounted but disabled outside the relative mode, so
 * switching back never loses what was typed. The default is chosen by the
 * caller: `never` when the key has no expiry, `keep` when it has one.
 */
export function ApiKeyExpiryField({
  currentExpiresAt,
  currentLabel,
  value,
  onChange,
  fieldErrors,
  messages,
}: {
  currentExpiresAt: string | null;
  /** Already formatted with the panel locale and time zone. */
  currentLabel: string;
  value: ExpiryChoice;
  onChange: (choice: ExpiryChoice) => void;
  fieldErrors: Record<string, string[]>;
  messages: TranslationMap;
}) {
  const [amountText, setAmountText] = useState(
    value.mode === "relative" ? String(value.amount) : "",
  );
  const [unit, setUnit] = useState<ExpiryUnit>(
    value.mode === "relative" ? value.unit : "days",
  );
  const relative = value.mode === "relative";
  const error = fieldErrors.expiry_amount?.[0] ?? fieldErrors.expires_at?.[0];

  function selectMode(mode: ExpiryChoice["mode"]) {
    if (mode === "relative") {
      onChange({ mode, amount: amountValue(amountText), unit });
      return;
    }
    if (mode === "keep") {
      onChange({ mode });
      return;
    }
    onChange({ mode: "never" });
  }

  function handleAmountChange(text: string) {
    setAmountText(text);
    onChange({ mode: "relative", amount: amountValue(text), unit });
  }

  function handleUnitChange(next: ExpiryUnit) {
    setUnit(next);
    onChange({ mode: "relative", amount: amountValue(amountText), unit: next });
  }

  const hasCurrent = currentExpiresAt !== null;

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-xs font-semibold">{t("Expiry", messages)}</legend>

      <label className="flex min-h-11 items-center gap-2 text-xs">
        <input
          type="radio"
          name="expiry_mode"
          value="never"
          checked={value.mode === "never"}
          onChange={() => selectMode("never")}
        />
        {t("Never expires", messages)}
      </label>

      {hasCurrent && (
        <>
          <label className="flex min-h-11 items-center gap-2 text-xs">
            <input
              type="radio"
              name="expiry_mode"
              value="keep"
              checked={value.mode === "keep"}
              onChange={() => selectMode("keep")}
            />
            {t("Keep current expiry", messages)}
          </label>
          <p className="pl-6 text-xs text-muted-foreground">
            {t("Currently expires on {date}", messages, { date: currentLabel })}
          </p>
        </>
      )}

      <label className="flex min-h-11 items-center gap-2 text-xs">
        <input
          type="radio"
          name="expiry_mode"
          value="relative"
          checked={relative}
          onChange={() => selectMode("relative")}
        />
        {t("Expires in", messages)}
      </label>

      <RelativeControls
        amountText={amountText}
        unit={unit}
        relative={relative}
        error={relative ? error : undefined}
        onAmountChange={handleAmountChange}
        onUnitChange={handleUnitChange}
        messages={messages}
      />

      <FieldError id={ERROR_ID} message={error} />
    </fieldset>
  );
}
