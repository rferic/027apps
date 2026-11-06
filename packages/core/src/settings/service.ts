/**
 * Settings service: read/write/mask over the seeded catalog (instance-config spec).
 *
 * Invariants:
 * - Secrets are write-only: the plaintext never leaves the write path, the
 *   database stores only `value_encrypted` (AES-256-GCM) and reads return
 *   `configured: boolean` instead of any value.
 * - Metadata (label, help, is_secret, is_public, mcp_access, source) lives in
 *   the catalog and can never be changed through the API.
 * - Every write validates against the catalog schema plus cross-key coherence.
 * - `security.jwt_expiry` is read-only: Supabase owns that value.
 */

import { z } from 'zod';
import { DomainError } from '../errors';
import { enqueueEvent } from '../realtime/service';
import type { EncryptionKeyPort } from '../crypto';
import type { QueryClient } from '../api/rate-limit-storage';
import { SETTINGS_CATALOG, getSettingMeta, type SettingMeta } from './catalog';
import type { Caller, JsonValue } from '../api/types';

/** Runs a unit of work on a single transactional client. */
export type TransactionRunner = <T>(fn: (db: QueryClient) => Promise<T>) => Promise<T>;

export interface SettingsDeps {
  db: QueryClient;
  /** Optional: when present, read/validate/write runs on one transaction. */
  withTransaction?: TransactionRunner;
  /** `null` = key missing from the environment: the instance runs degraded. */
  encryption: EncryptionKeyPort | null;
  currencies: { isEnabled(code: string, client?: QueryClient): Promise<boolean> };
  /** For the degraded log line; receives messages without secret values. */
  logger?: (message: string) => void;
}

export type SettingView = {
  key: string;
  category: string;
  label: string;
  help: string;
  isSecret: boolean;
  isPublic: boolean;
  mcpAccess: 'none' | 'read' | 'write';
  sortOrder: number;
  updatedBy: string | null;
  updatedAt: string;
  /** Present only for non-secrets: the current (or default) value. */
  value?: JsonValue;
  /** Present only for secrets: whether the secret has been configured. */
  configured?: boolean;
};

export interface HealthStatus {
  status: 'ok' | 'degraded';
  degradedReasons: string[];
}

function rowToView(row: Record<string, unknown>): SettingView {
  const key = String(row.key);
  const meta = getSettingMeta(key);
  if (!meta) {
    throw new DomainError('internal', `Setting ${key} has no catalog metadata`);
  }
  const base: SettingView = {
    key,
    category: meta.category,
    label: meta.label,
    help: meta.help,
    isSecret: meta.isSecret,
    isPublic: meta.isPublic,
    mcpAccess: meta.mcpAccess,
    sortOrder: meta.sortOrder,
    updatedBy: row.updated_by ? String(row.updated_by) : null,
    updatedAt: new Date(row.updated_at as string).toISOString(),
  };
  if (meta.isSecret) {
    return { ...base, configured: row.value_encrypted !== null };
  }
  // jsonb values come from the catalog schemas (all JSON-serializable).
  return { ...base, value: (row.value ?? null) as JsonValue };
}

/** Super-admin level means a session super_admin or a key capped at super_admin. */
function isSuperAdminLevel(caller: Caller): boolean {
  if (caller.kind === 'session') return caller.role === 'super_admin';
  if (caller.kind === 'service' || caller.kind === 'delegated') return caller.roleCap === 'super_admin';
  return false;
}

async function readSettingViews(deps: SettingsDeps): Promise<SettingView[]> {
  const { rows } = await deps.db.query(
    'select key, value, value_encrypted, updated_by, updated_at from public.settings',
  );
  return rows.map(rowToView);
}

/**
 * Settings for the admin API: non-secrets carry values, secrets are masked.
 * `superAdminOnly` keys are omitted entirely for callers below super-admin level.
 */
export async function readAllSettings(deps: SettingsDeps, caller: Caller): Promise<SettingView[]> {
  const views = await readSettingViews(deps);
  if (isSuperAdminLevel(caller)) return views;
  return views.filter((view) => !getSettingMeta(view.key)?.superAdminOnly);
}

/** Public settings for GET /instance: only `is_public` non-secret values. */
export async function readPublicSettings(deps: SettingsDeps): Promise<Record<string, JsonValue>> {
  const all = await readSettingViews(deps);
  const result: Record<string, JsonValue> = {};
  for (const setting of all) {
    if (setting.isPublic && !setting.isSecret && setting.value !== undefined) {
      result[setting.key] = setting.value;
    }
  }
  return result;
}

/** Whether a secret is configured, without touching its plaintext. */
export async function isSecretConfigured(deps: SettingsDeps, key: string): Promise<boolean> {
  const { rows } = await deps.db.query(
    'select value_encrypted from public.settings where key = $1',
    [key],
  );
  return rows.length > 0 && rows[0].value_encrypted !== null;
}

/** Current values (non-secrets) + configured state (secrets) of every catalog key. */
async function currentSettingsMap(deps: SettingsDeps): Promise<Record<string, unknown>> {
  const { rows } = await deps.db.query('select key, value, value_encrypted from public.settings');
  const map: Record<string, unknown> = {};
  for (const row of rows) {
    const key = String(row.key);
    if (row.value_encrypted !== null) {
      map[key] = 'configured'; // sentinel: secret present, plaintext never read here
    } else {
      map[key] = row.value ?? null;
    }
  }
  return map;
}

function assertCanWrite(caller: Caller, meta: SettingMeta): void {
  // v1: settings are session-only (MCP access arrives with sprint-06 keys).
  if (caller.kind !== 'session') {
    throw new DomainError('insufficient_scope');
  }
  if (meta.readOnly) {
    throw new DomainError('conflict', 'Setting is read-only');
  }
  if (meta.superAdminOnly && caller.role !== 'super_admin') {
    throw new DomainError('insufficient_scope');
  }
}

/**
 * Writes multiple settings in a single transaction. Validates all keys first,
 * validates schemas and coherence once on the merged map, then writes all.
 * Atomic: either all succeed or none are applied.
 */
export async function writeSettings(
  deps: SettingsDeps,
  caller: Caller,
  updates: ReadonlyArray<{ key: string; value: unknown }>,
): Promise<SettingView[]> {
  const seen = new Set<string>();
  for (const { key } of updates) {
    if (seen.has(key)) {
      throw new DomainError('validation_failed', 'Duplicate key', { key });
    }
    seen.add(key);
  }

  const parsedValues: Record<string, unknown> = {};
  for (const { key, value } of updates) {
    const meta = getSettingMeta(key);
    if (!meta) throw new DomainError('not_found');
    assertCanWrite(caller, meta);
    const parsed = meta.schema.safeParse(value);
    if (!parsed.success) {
      throw new DomainError('validation_failed', 'Validation failed', { key, ...parsed.error.flatten() });
    }
    parsedValues[key] = parsed.data;
  }

  const run = deps.withTransaction ?? (<T>(fn: (db: QueryClient) => Promise<T>) => fn(deps.db));

  return run(async (db) => {
    const txDeps: SettingsDeps = { ...deps, db };
    const current = await currentSettingsMap(txDeps);
    const merged = { ...current, ...parsedValues };
    await validateCoherence(txDeps, merged, db);

    const actor = auditFields(caller);

    // Encrypt every secret before the first UPDATE: a missing or unusable key
    // must abort the batch without touching any row, even without a real
    // transaction runner. Plaintext never reaches logs or error messages.
    const encryptedSecrets = new Map<string, string>();
    for (const { key } of updates) {
      const meta = getSettingMeta(key)!;
      if (!meta.isSecret) continue;
      if (!deps.encryption) {
        throw new DomainError('internal', 'SETTINGS_ENCRYPTION_KEY is not configured');
      }
      const newValue = parsedValues[key];
      const plaintext = typeof newValue === 'string' ? newValue : JSON.stringify(newValue);
      const encrypted = await deps.encryption.encrypt(plaintext, key);
      if (encrypted === null) {
        throw new DomainError('internal', 'SETTINGS_ENCRYPTION_KEY is not usable');
      }
      encryptedSecrets.set(key, encrypted);
    }

    for (const { key } of updates) {
      const newValue = parsedValues[key];
      const meta = getSettingMeta(key)!;

      if (meta.isSecret) {
        await db.query(
          `update public.settings set value_encrypted = $1, updated_by = $2, updated_by_key = $3, updated_at = now() where key = $4`,
          [encryptedSecrets.get(key), actor.updatedBy, actor.updatedByKey, key],
        );
      } else {
        await db.query(
          `update public.settings set value = $1, updated_by = $2, updated_by_key = $3, updated_at = now() where key = $4`,
          [JSON.stringify(newValue), actor.updatedBy, actor.updatedByKey, key],
        );
        await enqueueEvent(db, {
          type: "settings.updated",
          target: "admins",
          resource: {},
          payload: { category_key: meta.category, key },
        });
      }
    }

    const allViews = await readAllSettings(txDeps, caller);
    const viewByKey = new Map(allViews.map((view) => [view.key, view]));
    return updates.flatMap(({ key }) => {
      const view = viewByKey.get(key);
      return view ? [view] : [];
    });
  });
}

async function validateCoherence(
  deps: SettingsDeps,
  merged: Record<string, unknown>,
  client?: QueryClient,
): Promise<void> {
  for (const meta of SETTINGS_CATALOG) {
    if (!meta.validateCoherence) continue;
    try {
      meta.validateCoherence(merged);
    } catch (err) {
      throw new DomainError('validation_failed', (err as Error).message, {
        formErrors: [(err as Error).message],
        fieldErrors: {},
      });
    }
  }

  // Currency coherence: the default must exist and be enabled.
  const currency = merged['localization.default_currency'];
  if (typeof currency === 'string' && currency.length > 0) {
    if (!(await deps.currencies.isEnabled(currency, client))) {
      throw new DomainError('currency_not_enabled');
    }
  }
}

/**
 * Maps the caller to the audit actor columns. The DB CHECK allows at most one:
 * a human session sets `updated_by`; a machine key sets `updated_by_key`.
 *
 * The service/delegated branches are currently unreachable: `assertCanWrite`
 * rejects every non-session caller first. They stay as the intended contract
 * for when v1 opens settings writes to machine keys.
 */
function auditFields(caller: Caller): { updatedBy: string | null; updatedByKey: string | null } {
  switch (caller.kind) {
    case 'session':
    case 'delegated':
      return { updatedBy: caller.userId, updatedByKey: null };
    case 'service':
      return { updatedBy: null, updatedByKey: caller.keyId };
    case 'anon':
      return { updatedBy: null, updatedByKey: null };
  }
}

/**
 * Writes one setting value by delegating to writeSettings with a single update.
 * The schema validation, coherence, and write logic is shared with writeSettings.
 */
export async function writeSetting(
  deps: SettingsDeps,
  caller: Caller,
  key: string,
  value: unknown,
): Promise<SettingView> {
  const result = await writeSettings(deps, caller, [{ key, value }]);
  const setting = result[0];
  if (!setting) {
    throw new DomainError('internal', 'Setting row not found');
  }
  return setting;
}

/**
 * Health: `degraded` when the database is unreachable, or when secrets are
 * configured but the encryption key is missing (they would be unreadable).
 */
export async function computeHealth(deps: SettingsDeps): Promise<HealthStatus> {
  const reasons: string[] = [];
  let reachable = true;
  try {
    await deps.db.query('select 1');
  } catch {
    reachable = false;
    reasons.push('database_unreachable');
  }
  if (reachable) {
    const secretConfigured = await isSecretConfigured(deps, 'notifications.push.fcm_service_account');
    if (secretConfigured && !deps.encryption) {
      reasons.push('encryption_key_missing');
    }
  }
  return { status: reasons.length === 0 ? 'ok' : 'degraded', degradedReasons: reasons };
}

/**
 * Records the JWT expiry observed on the wizard's own access token (spec §7.2,
 * step 2). `security.jwt_expiry` is read-only over the API — the wizard only
 * mirrors what the Supabase project actually issues, with the new super_admin
 * as the audit actor.
 */
export async function recordJwtExpiry(
  db: QueryClient,
  actorId: string,
  seconds: number,
): Promise<void> {
  await db.query(
    'update public.settings set value = $1, updated_by = $2, updated_by_key = null, updated_at = now() where key = $3',
    [JSON.stringify(seconds), actorId, 'security.jwt_expiry'],
  );
}
