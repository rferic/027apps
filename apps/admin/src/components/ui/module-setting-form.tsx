"use client";

import { useActionState, useState } from "react";
import { saveSettingAction, type SaveState } from "@/lib/module-settings-actions";

export type ModuleSettingItem = {
  key: string;
  label: string;
  help: string | null;
  isSecret: boolean;
  type: string;
  min?: number;
  max?: number;
  step?: number;
  control?: string;
  /** Already serialized for the input: `"true"`, `"12"`, `"some text"` or JSON. */
  value: string;
};

const IDLE: SaveState = { status: "idle" };

function BoolField({ item }: { item: ModuleSettingItem }) {
  return (
    <label className="flex min-h-11 items-center gap-2 text-sm">
      <input
        type="checkbox"
        name="value"
        defaultChecked={item.value === "true"}
        className="h-5 w-5 rounded border-border accent-accent"
      />
      <span className="text-muted-foreground">{item.value === "true" ? "on" : "off"}</span>
    </label>
  );
}

function SliderField({
  item,
  onChange,
}: {
  item: ModuleSettingItem;
  onChange?: (value: string) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <input
        type="range"
        name="value"
        min={item.min}
        max={item.max}
        step={item.step ?? 1}
        defaultValue={item.value}
        onChange={(event) => onChange?.(event.target.value)}
        className="h-11 w-full accent-accent"
      />
      <output className="w-14 text-right text-sm font-semibold tabular-nums">{item.value}</output>
    </div>
  );
}

const FIELD_CLASS =
  "min-h-11 w-full rounded-control border border-border bg-surface px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

function JsonField({ item }: { item: ModuleSettingItem }) {
  return (
    <textarea
      name="value"
      defaultValue={item.value}
      rows={4}
      className={`${FIELD_CLASS} py-2 font-mono text-xs`}
    />
  );
}

function LocaleField({ item }: { item: ModuleSettingItem }) {
  return (
    <select name="value" defaultValue={item.value} className={FIELD_CLASS}>
      {["en", "es", "ca", "it", "fr", "de", "pt", "gl", "eu"].map((locale) => (
        <option key={locale} value={locale}>
          {locale}
        </option>
      ))}
    </select>
  );
}

function PlainField({ item }: { item: ModuleSettingItem }) {
  return (
    <input
      type={item.isSecret ? "password" : item.type === "int" ? "number" : "text"}
      name="value"
      defaultValue={item.value}
      min={item.min}
      max={item.max}
      step={item.step}
      autoComplete="off"
      className={FIELD_CLASS}
    />
  );
}

function Field({ item, onChange }: { item: ModuleSettingItem; onChange?: (value: string) => void }) {
  if (item.type === "bool") return <BoolField item={item} />;
  if (item.type === "int" && item.control === "slider" && item.min !== undefined && item.max !== undefined) {
    return <SliderField item={item} onChange={onChange} />;
  }
  if (item.type === "json") return <JsonField item={item} />;
  if (item.type === "locale") return <LocaleField item={item} />;
  return <PlainField item={item} />;
}

function SettingRow({
  moduleKey,
  item,
  labels,
}: {
  moduleKey: string;
  item: ModuleSettingItem;
  labels: { save: string; saved: string; failed: string };
}) {
  const [state, action, pending] = useActionState(saveSettingAction, IDLE);
  const [value, setValue] = useState(item.value);

  return (
    <form action={action} className="flex flex-col gap-2 border-b border-border py-3 last:border-b-0">
      <input type="hidden" name="moduleKey" value={moduleKey} />
      <input type="hidden" name="settingKey" value={item.key} />
      <input type="hidden" name="settingType" value={item.type} />

      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-semibold">{item.label}</span>
        <code className="font-mono text-[11px] text-muted-foreground">{item.key}</code>
        {item.help ? <span className="text-xs text-muted-foreground">{item.help}</span> : null}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-48 flex-1">
          <Field item={{ ...item, value }} onChange={setValue} />
        </div>
        <button
          type="submit"
          disabled={pending}
          className="min-h-11 rounded-control bg-primary px-3 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {labels.save}
        </button>
      </div>

      {state.status === "ok" ? (
        <p role="status" className="text-xs text-success">
          {labels.saved}
        </p>
      ) : null}
      {state.status === "error" ? (
        <p role="alert" className="text-xs text-destructive">
          {labels.failed}
        </p>
      ) : null}
    </form>
  );
}

export function ModuleSettingsForm({
  moduleKey,
  items,
  labels,
}: {
  moduleKey: string;
  items: ModuleSettingItem[];
  labels: { save: string; saved: string; failed: string };
}) {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-col">
      {items.map((item) => (
        <SettingRow key={item.key} moduleKey={moduleKey} item={item} labels={labels} />
      ))}
    </div>
  );
}
