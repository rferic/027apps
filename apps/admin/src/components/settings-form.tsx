"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { t } from "@027apps/i18n/t.js";
import type { Locale, TranslationMap } from "@027apps/i18n/types.js";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FormActions, FormAlert, FormField, FormSection } from "@/components/ui/form";
import { LOCALE_LABELS } from "@/lib/locale";
import type { MutationFailure } from "@/lib/mutation-result";
import { panelErrorCodeLabel } from "@/lib/panel-errors";
import type { RestrictedSetting, SettingRow, SettingsCategoryRow } from "@/lib/setting-types";
import {
  encodeSettingValue,
  initialSettingsDraft,
  updatesFromDraft,
  type SettingsDraft,
} from "@/lib/settings-form";
import { patchSettingsBatch } from "@/lib/settings-mutations";

const inputClass =
  "min-h-11 rounded-control border border-border bg-background px-2.5 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

const PANEL_LOCALES = Object.keys(LOCALE_LABELS) as Locale[];

function fieldId(key: string): string {
  return `setting-${key.replaceAll(".", "-")}`;
}

function allSettings(categories: readonly SettingsCategoryRow[]): SettingRow[] {
  return categories.flatMap((category) => category.settings);
}

function errorFor(
  failure: MutationFailure | null,
  key: string,
  messages: TranslationMap,
): string | undefined {
  if (!failure) return undefined;
  const details = failure.details;
  if (!details || details.key !== key) return undefined;
  const detail = details.formErrors?.[0] ?? details.fieldErrors?.value?.[0];
  if (detail) return detail;
  return failure.code ? panelErrorCodeLabel(failure.code, messages) : undefined;
}

function SaveError({
  error,
  messages,
}: {
  error: MutationFailure;
  messages: TranslationMap;
}) {
  return (
    <FormAlert
      message={t("We couldn't save the settings.", messages)}
      code={error.code}
      details={error.details?.formErrors}
      requestId={error.requestId}
      messages={messages}
    />
  );
}

function InlineError({ keyName, error, messages }: { keyName: string; error: MutationFailure | null; messages: TranslationMap }) {
  if (error?.details?.key !== keyName) return null;
  return (
    <p id={`${fieldId(keyName)}-error`} role="alert" className="text-xs font-semibold text-destructive">
      {errorFor(error, keyName, messages) ?? t("This value is not valid.", messages)}
    </p>
  );
}

function SecretInput({
  setting,
  value,
  onChange,
  messages,
}: {
  setting: SettingRow;
  value: string;
  onChange: (value: string) => void;
  messages: TranslationMap;
}) {
  const id = fieldId(setting.key);
  const placeholder = setting.configured
    ? t("Leave empty to keep the current value.", messages)
    : t("Paste the secret value.", messages);
  return (
    <FormField
      id={id}
      label={
        <>
          {setting.label}
          <Badge variant={setting.configured ? "success" : "neutral"}>
            {setting.configured ? t("Configured", messages) : t("Not configured", messages)}
          </Badge>
        </>
      }
      hint={
        <>
          {setting.help}
          {setting.configured && (
            <span className="block">
              {t("The saved secret is never shown. Type a new value only to replace it.", messages)}
            </span>
          )}
        </>
      }
    >
      {setting.type === "json" ? (
        <textarea
          id={id}
          name={setting.key}
          rows={4}
          autoComplete="off"
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          className={`${inputClass} min-h-24 py-2 font-mono text-xs`}
        />
      ) : (
        <input
          id={id}
          name={setting.key}
          type="password"
          autoComplete="off"
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          className={inputClass}
        />
      )}
    </FormField>
  );
}

function LocaleInput({
  setting,
  value,
  onChange,
  error,
  messages,
}: {
  setting: SettingRow;
  value: string;
  onChange: (value: string) => void;
  error: MutationFailure | null;
  messages: TranslationMap;
}) {
  const selected = new Set(
    value
      .split(",")
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0),
  );

  function toggle(locale: Locale) {
    const next = new Set(selected);
    if (next.has(locale)) next.delete(locale);
    else next.add(locale);
    onChange(PANEL_LOCALES.filter((entry) => next.has(entry)).join(", "));
  }

  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="text-xs font-semibold">{setting.label}</legend>
      <div className="flex flex-wrap gap-x-4">
        {PANEL_LOCALES.map((locale) => (
          <label key={locale} className="flex min-h-11 items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={selected.has(locale)}
              disabled={locale === "en"}
              onChange={() => toggle(locale)}
            />
            {LOCALE_LABELS[locale]}
          </label>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">{setting.help}</p>
      <InlineError keyName={setting.key} error={error} messages={messages} />
    </fieldset>
  );
}

function EnumInput({
  setting,
  value,
  onChange,
}: {
  setting: SettingRow;
  value: string;
  onChange: (value: string) => void;
}) {
  const options = setting.key === "notifications.push.provider" ? ["fcm", "none"] : [value];
  return (
    <FormField id={fieldId(setting.key)} label={setting.label} hint={setting.help}>
      <select
        id={fieldId(setting.key)}
        name={setting.key}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={inputClass}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </FormField>
  );
}

function ScalarInput({
  setting,
  value,
  onChange,
}: {
  setting: SettingRow;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <FormField id={fieldId(setting.key)} label={setting.label} hint={setting.help}>
      <input
        id={fieldId(setting.key)}
        name={setting.key}
        type={setting.type === "int" ? "number" : "text"}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={inputClass}
      />
    </FormField>
  );
}

function ArrayInput({
  setting,
  value,
  onChange,
  messages,
}: {
  setting: SettingRow;
  value: string;
  onChange: (value: string) => void;
  messages: TranslationMap;
}) {
  return (
    <FormField
      id={fieldId(setting.key)}
      label={setting.label}
      hint={
        <>
          {setting.help}
          <span className="block">{t("One entry per line.", messages)}</span>
        </>
      }
    >
      <textarea
        id={fieldId(setting.key)}
        name={setting.key}
        rows={3}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`${inputClass} py-2 font-mono text-xs`}
      />
    </FormField>
  );
}

function ReadOnlySetting({ setting, messages }: { setting: SettingRow; messages: TranslationMap }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-semibold">{setting.label}</span>
      <p className="font-mono text-xs text-foreground">{encodeSettingValue(setting)}</p>
      <p className="text-xs text-muted-foreground">{setting.help}</p>
      <p className="text-xs font-semibold text-muted-foreground">{t("This value is read-only.", messages)}</p>
    </div>
  );
}

export function SettingField({
  setting,
  draft,
  onChange,
  error,
  messages,
}: {
  setting: SettingRow;
  draft: SettingsDraft;
  onChange: (key: string, value: string) => void;
  error: MutationFailure | null;
  messages: TranslationMap;
}) {
  const value = draft[setting.key] ?? "";

  if (setting.readOnly) return <ReadOnlySetting setting={setting} messages={messages} />;
  if (setting.isSecret) {
    return (
      <div className="flex flex-col gap-1">
        <SecretInput
          setting={setting}
          value={value}
          onChange={(next) => onChange(setting.key, next)}
          messages={messages}
        />
        <InlineError keyName={setting.key} error={error} messages={messages} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      {setting.type === "locales" ? (
        <LocaleInput
          setting={setting}
          value={value}
          onChange={(next) => onChange(setting.key, next)}
          error={error}
          messages={messages}
        />
      ) : setting.type === "array" ? (
        <ArrayInput
          setting={setting}
          value={value}
          onChange={(next) => onChange(setting.key, next)}
          messages={messages}
        />
      ) : setting.type === "enum" ? (
        <EnumInput setting={setting} value={value} onChange={(next) => onChange(setting.key, next)} />
      ) : (
        <ScalarInput setting={setting} value={value} onChange={(next) => onChange(setting.key, next)} />
      )}
      {setting.type !== "locales" && (
        <InlineError keyName={setting.key} error={error} messages={messages} />
      )}
    </div>
  );
}

function RestrictedSettingRow({ setting, messages }: { setting: RestrictedSetting; messages: TranslationMap }) {
  return (
    <div className="flex flex-col gap-1 rounded-control border border-border bg-muted p-2">
      <span className="text-xs font-semibold">{setting.label}</span>
      <p className="text-xs text-muted-foreground">{setting.help}</p>
      <p className="text-xs font-semibold text-muted-foreground">
        {t("Only a super administrator can view this value.", messages)}
      </p>
    </div>
  );
}

function CategorySection({
  category,
  draft,
  restricted,
  error,
  onChange,
  messages,
}: {
  category: SettingsCategoryRow;
  draft: SettingsDraft;
  restricted: RestrictedSetting[];
  error: MutationFailure | null;
  onChange: (key: string, value: string) => void;
  messages: TranslationMap;
}) {
  const hidden = restricted.filter((setting) => setting.category === category.categoryKey);
  return (
    <FormSection title={category.label} description={category.help}>
      {category.settings.map((setting) => (
        <SettingField
          key={setting.key}
          setting={setting}
          draft={draft}
          onChange={onChange}
          error={error}
          messages={messages}
        />
      ))}
      {hidden.map((setting) => (
        <RestrictedSettingRow key={setting.key} setting={setting} messages={messages} />
      ))}
    </FormSection>
  );
}

/**
 * One batch save for every changed key (task-04 endpoint). The draft starts
 * from the API values; secrets start empty on purpose (empty = keep). Read-only
 * and super-admin-only rows are composed server-side and never submitted.
 */
export function SettingsForm({
  categories,
  restricted,
  messages,
}: {
  categories: SettingsCategoryRow[];
  restricted: RestrictedSetting[];
  messages: TranslationMap;
}) {
  const router = useRouter();
  const settings = allSettings(categories);
  const [draft, setDraft] = useState<SettingsDraft>(() => initialSettingsDraft(settings));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<MutationFailure | null>(null);

  const updates = updatesFromDraft(settings, draft);

  function change(key: string, value: string) {
    setDraft((current) => ({ ...current, [key]: value }));
    setSaved(false);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    const result = await patchSettingsBatch(updates);
    setSaving(false);
    if (!result.ok) {
      setError(result);
      return;
    }
    // A replaced secret must not stay in client state after the Core accepts it.
    const cleared = { ...draft };
    for (const setting of settings) {
      if (setting.isSecret) cleared[setting.key] = "";
    }
    setDraft(cleared);
    setSaved(true);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {categories.map((category) => (
        <CategorySection
          key={category.categoryKey}
          category={category}
          draft={draft}
          restricted={restricted}
          error={error}
          onChange={change}
          messages={messages}
        />
      ))}

      {error && <SaveError error={error} messages={messages} />}
      {saved && (
        <p role="status" className="text-xs font-semibold text-success">
          {t("Changes saved.", messages)}
        </p>
      )}

      <FormActions>
        <Button type="submit" variant="primary" className="min-h-11" disabled={saving || updates.length === 0}>
          {saving ? t("Saving…", messages) : t("Save changes", messages)}
        </Button>
      </FormActions>
    </form>
  );
}
