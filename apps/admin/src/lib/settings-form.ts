import type { SettingRow } from "@/lib/setting-types";

/** Form state: one text field per catalog key. Secrets never store their value. */
export type SettingsDraft = Record<string, string>;

/** Origins the API door accepts, as an exact-match string array. */
export const CORS_SETTING_KEY = "security.cors_allowlist";

function listToText(value: unknown, separator: string): string {
  if (!Array.isArray(value)) return "";
  return value.filter((entry): entry is string => typeof entry === "string").join(separator);
}

/** Text the form edits for a setting; secrets always start empty. */
export function encodeSettingValue(setting: SettingRow): string {
  if (setting.isSecret) return "";
  if (setting.type === "locales") return listToText(setting.value, ", ");
  if (setting.type === "array") return listToText(setting.value, "\n");
  if (setting.value === null || setting.value === undefined) return "";
  return String(setting.value);
}

export function initialSettingsDraft(settings: readonly SettingRow[]): SettingsDraft {
  const draft: SettingsDraft = {};
  for (const setting of settings) draft[setting.key] = encodeSettingValue(setting);
  return draft;
}

function lines(value: string): string[] {
  return value
    .split(/\r?\n|,/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function locales(value: string): string[] {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

/**
 * Converts the field text to the JSON value the catalog schema expects. A
 * malformed int stays as text so the API rejects it and the batch error names
 * the key (the form never silently drops a user edit).
 */
export function parseSettingValue(setting: SettingRow, raw: string): unknown {
  if (setting.type === "locales") return locales(raw);
  if (setting.type === "array") return lines(raw);
  if (setting.type === "int") {
    const parsed = Number(raw);
    return raw.trim() !== "" && Number.isFinite(parsed) ? parsed : raw;
  }
  return raw;
}

function sameValue(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Puts the saved locale selection back after the API rejects it (for example
 * when removing the current default_locale). Other unsaved edits are kept.
 */
export function revertEnabledLocales(
  settings: readonly SettingRow[],
  draft: SettingsDraft,
): SettingsDraft {
  const next = { ...draft };
  for (const setting of settings) {
    if (setting.type === "locales") next[setting.key] = encodeSettingValue(setting);
  }
  return next;
}

/**
 * The batch body: only changed keys, never a read-only key, and a secret only
 * when its field is non-empty (empty = keep the configured one).
 */
export function updatesFromDraft(
  settings: readonly SettingRow[],
  draft: SettingsDraft,
): Array<{ key: string; value: unknown }> {
  const updates: Array<{ key: string; value: unknown }> = [];
  for (const setting of settings) {
    if (setting.readOnly) continue;
    const raw = draft[setting.key] ?? "";

    if (setting.isSecret) {
      if (raw.trim() !== "") updates.push({ key: setting.key, value: raw });
      continue;
    }

    const next = parseSettingValue(setting, raw);
    if (!sameValue(next, setting.value)) updates.push({ key: setting.key, value: next });
  }
  return updates;
}

function strings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === "string");
}

/**
 * The door compares `Origin` headers against the stored array by exact string
 * (`packages/core/src/api/door.ts:38-43`), so a trailing slash or a different
 * port is a different origin.
 *
 * Only the entries the save drops matter: the panel is served by the same app
 * as the API and the browser skips CORS for same-origin calls, so removing its
 * own origin changes nothing for the panel. What it does take away is browser
 * access for the external applications listed here.
 */
export function corsRemovals(saved: unknown, next: unknown): string[] {
  const after = new Set(strings(next));
  return strings(saved).filter((origin) => !after.has(origin));
}

/** Same decision, from the batch the form is about to send. */
export function corsUpdateRemovals(
  settings: readonly SettingRow[],
  updates: readonly { key: string; value: unknown }[],
): string[] {
  const saved = settings.find((setting) => setting.key === CORS_SETTING_KEY);
  const changed = updates.find((update) => update.key === CORS_SETTING_KEY);
  if (!saved || !changed) return [];
  return corsRemovals(saved.value, changed.value);
}

/**
 * One Save pass. A batch that drops origins never reaches the API unconfirmed:
 * the caller shows the dialog with `removedOrigins` and only calls `send` after
 * the user accepts. Adding or reordering origins sends the batch right away.
 */
export async function submitSettings(
  settings: readonly SettingRow[],
  draft: SettingsDraft,
  deps: {
    send: (updates: Array<{ key: string; value: unknown }>) => Promise<void>;
    confirm: (removedOrigins: readonly string[]) => Promise<boolean>;
  },
): Promise<void> {
  const updates = updatesFromDraft(settings, draft);
  const removedOrigins = corsUpdateRemovals(settings, updates);
  if (removedOrigins.length > 0 && !(await deps.confirm(removedOrigins))) return;
  await deps.send(updates);
}
