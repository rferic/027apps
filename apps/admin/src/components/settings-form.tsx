"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { t } from "@027apps/i18n/t.js";
import type { Locale, TranslationMap } from "@027apps/i18n/types.js";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { FormActions, FormAlert, FormField, FormSection } from "@/components/ui/form";
import { MultiSelect } from "@/components/ui/multi-select";
import { Select } from "@/components/ui/select";
import { TimeZoneInput } from "@/components/ui/time-zone-input";
import { LOCALE_LABELS, localeOptions } from "@/lib/locale";
import type { MutationFailure } from "@/lib/mutation-result";
import { panelErrorCodeLabel } from "@/lib/panel-errors";
import { categoryHelp, categoryLabel, settingHelp, settingLabel } from "@/lib/setting-text";
import type { RestrictedSetting, SettingRow, SettingsCategoryRow } from "@/lib/setting-types";
import {
  CORS_SETTING_KEY,
  encodeSettingValue,
  initialSettingsDraft,
  revertEnabledLocales,
  submitSettings,
  updatesFromDraft,
  type SettingsDraft,
} from "@/lib/settings-form";
import { patchSettingsBatch } from "@/lib/settings-mutations";
import { useResetOnRouteChange } from "@/lib/use-reset-on-route";

const inputClass =
  "min-h-11 rounded-control border border-border bg-background px-2.5 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

const PANEL_LOCALES = Object.keys(LOCALE_LABELS) as Locale[];

/** Setting whose free text gets IANA zone suggestions (see TimeZoneInput). */
const TIME_ZONE_KEY = "localization.timezone";

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

export function SaveError({
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
  const label = settingLabel(setting.key, messages, setting.label);
  const help = settingHelp(setting.key, messages, setting.help);
  const placeholder = setting.configured
    ? t("Leave empty to keep the current value.", messages)
    : t("Paste the secret value.", messages);
  return (
    <FormField
      id={id}
      label={
        <>
          {label}
          <Badge variant={setting.configured ? "success" : "neutral"}>
            {setting.configured ? t("Configured", messages) : t("Not configured", messages)}
          </Badge>
        </>
      }
      hint={
        <>
          {help}
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
  const values = value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
  const label = settingLabel(setting.key, messages, setting.label);
  const help = settingHelp(setting.key, messages, setting.help);

  function toggle(locale: string) {
    const next = new Set(values);
    if (next.has(locale)) next.delete(locale);
    else next.add(locale);
    onChange(PANEL_LOCALES.filter((entry) => next.has(entry)).join(", "));
  }

  return (
    <div className="flex flex-col gap-1">
      <MultiSelect
        label={label}
        placeholder={label}
        searchPlaceholder={t("Search by name, code or symbol.", messages)}
        options={localeOptions()}
        values={values}
        onToggle={toggle}
        onClear={() => onChange("en")}
        emptyLabel={t("No locales match", messages)}
        messages={messages}
      />
      <p className="text-xs text-muted-foreground">{help}</p>
      <InlineError keyName={setting.key} error={error} messages={messages} />
    </div>
  );
}

function EnumInput({
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
  const options = setting.key === "notifications.push.provider" ? ["fcm", "none"] : [value];
  return (
    <FormField
      id={fieldId(setting.key)}
      label={settingLabel(setting.key, messages, setting.label)}
      hint={settingHelp(setting.key, messages, setting.help)}
    >
      <Select
        id={fieldId(setting.key)}
        name={setting.key}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </Select>
    </FormField>
  );
}

/** A boolean setting is a checkbox: its draft value is "true" or "false". */
function BooleanInput({
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
  return (
    <FormField
      id={id}
      label={settingLabel(setting.key, messages, setting.label)}
      hint={settingHelp(setting.key, messages, setting.help)}
    >
      <input
        id={id}
        name={setting.key}
        type="checkbox"
        checked={value === "true"}
        onChange={(event) => onChange(event.target.checked ? "true" : "false")}
        className="h-4 w-4 accent-accent"
      />
    </FormField>
  );
}

function ScalarInput({
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
  const id = fieldId(setting.key);
  const hint = settingHelp(setting.key, messages, setting.help);
  // Mirrors InlineError: the field is invalid when the failure names its key.
  const hasError = error?.details?.key === setting.key;
  return (
    <FormField id={id} label={settingLabel(setting.key, messages, setting.label)} hint={hint}>
      {setting.key === TIME_ZONE_KEY ? (
        <TimeZoneInput
          id={id}
          name={setting.key}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-describedby={
            [hint ? `${id}-hint` : undefined, hasError ? `${id}-error` : undefined]
              .filter(Boolean)
              .join(" ") || undefined
          }
          aria-invalid={hasError ? true : undefined}
        />
      ) : (
        <input
          id={fieldId(setting.key)}
          name={setting.key}
          type={setting.type === "int" ? "number" : "text"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={inputClass}
        />
      )}
    </FormField>
  );
}

/**
 * Dynamic lines under an array field. The CORS allowlist is the only array
 * whose empty state is a real choice: it locks every external client out and
 * the panel keeps working because it calls the API from its own origin.
 */
function arrayHints(key: string, value: string, messages: TranslationMap): string[] {
  if (key !== CORS_SETTING_KEY) return [t("One entry per line.", messages)];
  if (value.trim() === "") {
    return [
      t(
        "With an empty list, no external application can call the API. This panel does not need to be listed: it calls from its own origin.",
        messages,
      ),
    ];
  }
  return [
    t("One entry per line.", messages),
    t(
      "The origin of this panel must be listed only if it calls the API from a different origin.",
      messages,
    ),
  ];
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
      label={settingLabel(setting.key, messages, setting.label)}
      hint={
        <>
          {settingHelp(setting.key, messages, setting.help)}
          {arrayHints(setting.key, value, messages).map((line) => (
            <span key={line} className="block">
              {line}
            </span>
          ))}
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
      <span className="text-xs font-semibold">
        {settingLabel(setting.key, messages, setting.label)}
      </span>
      <p className="font-mono text-xs text-foreground">{encodeSettingValue(setting)}</p>
      <p className="text-xs text-muted-foreground">
        {settingHelp(setting.key, messages, setting.help)}
      </p>
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
      ) : setting.type === "boolean" ? (
        <BooleanInput
          setting={setting}
          value={value}
          onChange={(next) => onChange(setting.key, next)}
          messages={messages}
        />
      ) : setting.type === "enum" ? (
        <EnumInput
          setting={setting}
          value={value}
          onChange={(next) => onChange(setting.key, next)}
          messages={messages}
        />
      ) : (
        <ScalarInput
          setting={setting}
          value={value}
          onChange={(next) => onChange(setting.key, next)}
          error={error}
          messages={messages}
        />
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
      <span className="text-xs font-semibold">
        {settingLabel(setting.key, messages, setting.label)}
      </span>
      <p className="text-xs text-muted-foreground">
        {settingHelp(setting.key, messages, setting.help)}
      </p>
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
  showHeading,
  onChange,
  messages,
}: {
  category: SettingsCategoryRow;
  draft: SettingsDraft;
  restricted: RestrictedSetting[];
  error: MutationFailure | null;
  showHeading: boolean;
  onChange: (key: string, value: string) => void;
  messages: TranslationMap;
}) {
  const hidden = restricted.filter((setting) => setting.category === category.categoryKey);
  const fields = (
    <>
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
    </>
  );

  if (!showHeading) {
    return (
      <div className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4">
        {fields}
      </div>
    );
  }

  return (
    <FormSection
      title={categoryLabel(category.categoryKey, messages, category.label)}
      description={categoryHelp(category.categoryKey, messages, category.help)}
    >
      {fields}
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
  const corsDialogRef = useRef<HTMLDialogElement>(null);
  const pendingCorsConfirm = useRef<((confirmed: boolean) => void) | null>(null);
  const [removedOrigins, setRemovedOrigins] = useState<string[]>([]);

  // Activity keeps this form mounted while the user visits another route: the
  // unsaved draft would come back as if the server had accepted it. Re-seed it
  // from the values the server sent this time. The saved confirmation is left
  // alone: after our own save the refresh brings exactly the saved values.
  useResetOnRouteChange(settings, () => {
    setDraft(initialSettingsDraft(settings));
    setError(null);
  });

  const updates = updatesFromDraft(settings, draft);

  function change(key: string, value: string) {
    setDraft((current) => ({ ...current, [key]: value }));
    setSaved(false);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Dropping an origin takes browser API access away from the external apps
    // listed there, so ask first and send nothing on this pass. The panel is
    // not at risk: it calls the API from its own origin, where there is no CORS.
    await submitSettings(settings, draft, {
      send: save,
      confirm: askToRemoveOrigins,
    });
  }

  function askToRemoveOrigins(removed: readonly string[]): Promise<boolean> {
    setRemovedOrigins([...removed]);
    corsDialogRef.current?.showModal();
    return new Promise((resolve) => {
      pendingCorsConfirm.current = resolve;
    });
  }

  function settleCorsDialog(confirmed: boolean) {
    const resolve = pendingCorsConfirm.current;
    pendingCorsConfirm.current = null;
    corsDialogRef.current?.close();
    resolve?.(confirmed);
  }

  async function save(changes: Array<{ key: string; value: unknown }>) {
    setSaving(true);
    setError(null);
    setSaved(false);
    const result = await patchSettingsBatch(changes);
    setSaving(false);
    if (!result.ok) {
      setError(result);
      // A coherence failure (default_locale removed from enabled_locales) is
      // reported as formErrors, not on a field: put the saved selection back so
      // the selector never shows a list the Core refused.
      if (result.details?.formErrors && result.details.formErrors.length > 0) {
        setDraft((current) => revertEnabledLocales(settings, current));
      }
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
          showHeading={categories.length > 1}
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

      <Dialog
        labelledBy="cors-confirm-title"
        ref={corsDialogRef}
        onClose={() => settleCorsDialog(false)}
        onBackdropClick={() => settleCorsDialog(false)}
      >
        <h2 id="cors-confirm-title" className="text-sm font-semibold">
          {t("Remove these origins?", messages)}
        </h2>
        <p className="mt-2 text-xs text-muted-foreground">
          {t(
            "Applications that call the API from these origins will no longer be able to:",
            messages,
          )}
        </p>
        <ul className="mt-1 font-mono text-xs text-foreground">
          {removedOrigins.map((origin) => (
            <li key={origin}>{origin}</li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-muted-foreground">
          {t(
            "This panel is not affected: it is served from the same origin as the API.",
            messages,
          )}
        </p>
        <FormActions className="mt-3">
          <Button
            type="button"
            variant="secondary"
            className="min-h-11"
            onClick={() => settleCorsDialog(false)}
          >
            {t("Cancel", messages)}
          </Button>
          <Button
            type="button"
            variant="destructive"
            className="min-h-11"
            onClick={() => settleCorsDialog(true)}
          >
            {t("Save anyway", messages)}
          </Button>
        </FormActions>
      </Dialog>
    </form>
  );
}
