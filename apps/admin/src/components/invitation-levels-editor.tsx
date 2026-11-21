"use client";

import { useState } from "react";
import { t } from "@027apps/i18n/t.js";
import type { TranslationMap } from "@027apps/i18n/types.js";
import {
  addInvitationLevel,
  clampInvitationQuota,
  maxAccounts,
  parseQuotaDraft,
  removeInvitationLevel,
  MAX_INVITATION_LEVELS,
  type InvitationLevel,
} from "@/lib/settings-form";

const inputClass =
  "min-h-9 w-20 rounded-control border border-border bg-background px-2.5 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

const buttonClass =
  "inline-flex min-h-9 items-center rounded-control border border-border px-2.5 text-xs font-semibold text-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

/**
 * Edits the `invitations.levels` setting as rows instead of raw JSON. Rows are
 * numbered contiguously from 1 (removing one renumbers the rest), the quota is
 * clamped to 0..100, and at most 20 levels can exist. The footer shows the
 * maximum number of accounts the table can produce from one admin invitation,
 * and an empty table warns that only administrators can invite.
 */
export function InvitationLevelsEditor({
  value,
  onChange,
  messages,
}: {
  value: InvitationLevel[];
  onChange: (next: InvitationLevel[]) => void;
  messages: TranslationMap;
}) {
  function updateQuota(index: number, quota: number) {
    const next = value.map((row, i) =>
      i === index ? { level: row.level, quota: clampInvitationQuota(quota) } : row,
    );
    onChange(next);
  }

  const accounts = maxAccounts(value);
  // The raw text per row while the user types. The empty string must stay
  // empty: coercing it to 0 on every keystroke turns the next digit into "02".
  const [quotaDrafts, setQuotaDrafts] = useState<Record<number, string>>({});

  return (
    <div className="flex flex-col gap-2">
      {value.length === 0 ? (
        <p role="status" className="text-xs font-semibold text-warning">
          {t("Only administrators can invite.", messages)}
        </p>
      ) : (
        <ul className="flex flex-col gap-1">
          {value.map((row, index) => (
            <li key={index} className="flex items-center gap-2">
              <span className="w-16 text-xs font-semibold">
                {t("Level {level}", messages, { level: row.level })}
              </span>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={3}
                value={quotaDrafts[index] ?? String(row.quota)}
                aria-label={t("Level {level} seats", messages, { level: row.level })}
                onChange={(event) => {
                  const raw = event.target.value;
                  if (!/^\d{0,3}$/.test(raw)) return;
                  setQuotaDrafts((current) => ({ ...current, [index]: raw }));
                  const quota = parseQuotaDraft(raw);
                  if (quota !== null) updateQuota(index, quota);
                }}
                onBlur={() => {
                  setQuotaDrafts((current) => {
                    const raw = current[index];
                    if (raw === undefined) return current;
                    const next = { ...current };
                    if (raw === "") delete next[index];
                    else next[index] = String(parseQuotaDraft(raw) ?? row.quota);
                    return next;
                  });
                }}
                className={inputClass}
              />
              <button
                type="button"
                onClick={() => {
                  setQuotaDrafts({});
                  onChange(removeInvitationLevel(value, index));
                }}
                className={buttonClass}
              >
                {t("Remove", messages)}
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => onChange(addInvitationLevel(value))}
          disabled={value.length >= MAX_INVITATION_LEVELS}
          className={buttonClass}
        >
          {t("Add level", messages)}
        </button>
        <span className="text-xs text-muted-foreground">
          {t("At most 20 levels · seats 0–100", messages)}
        </span>
      </div>

      <p className="text-xs text-muted-foreground">
        {t("This configuration allows {count} accounts per administrator invitation.", messages, {
          count: accounts,
        })}
      </p>
    </div>
  );
}
