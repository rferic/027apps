/**
 * Settings API routes (instance-config spec §6): reads for admins (masked
 * secrets) and value-only PATCH with catalog validation and super_admin rules
 * for `security.*`, `instance.public_url` and `cors_allowlist`.
 */

import { z } from 'zod';
import { withDoor } from '../api/door';
import { DomainError } from '../errors';
import type { Caller, CorsOptions, DoorDeps } from '../api/types';
import { SETTINGS_CATEGORIES } from './catalog';
import { readAllSettings, writeSetting, writeSettings, type SettingView, type SettingsDeps } from './service';

export interface SettingsRouteDeps {
  door: DoorDeps;
  auth: (req: Request) => Promise<Caller>;
  settings: SettingsDeps;
  cors?: CorsOptions;
  rateLimits?: { public?: number; read?: number; write?: number };
}

/** Canonical key: `<category>.<name>` (e.g. `instance.name`). */
const KEY_PATTERN = /^[a-z][a-z0-9_]*(\.[a-z0-9_]+)+$/;

/** Default write limit: wizard batch (12 writes) + margin. */
export const DEFAULT_WRITE_LIMIT = 30;

export const patchSettingBodySchema = z.object({ value: z.unknown() }).strict();

export const patchSettingsBodySchema = z.object({
  updates: z.array(z.object({ key: z.string(), value: z.unknown() }).strict()).min(1).max(30),
}).strict();

function sortSettings(settings: SettingView[]): SettingView[] {
  return settings.sort((a, b) => a.sortOrder - b.sortOrder || a.key.localeCompare(b.key));
}

/** GET /api/v1/settings — all settings, secrets masked as `configured`. */
export function settingsRoute(deps: SettingsRouteDeps) {
  return (req: Request): Promise<Response> =>
    withDoor(
      req,
      {
        scopes: ['settings:read'],
        auth: deps.auth,
        cors: deps.cors,
        rateLimit: { identity: 'user', limit: deps.rateLimits?.read ?? 120 },
      },
      deps.door,
      async (ctx) => {
        const settings = sortSettings(await readAllSettings(deps.settings, ctx.caller));
        return { settings };
      },
    );
}

/** GET /api/v1/settings-categories — categories with their settings, by sort order. */
export function settingsCategoriesRoute(deps: SettingsRouteDeps) {
  return (req: Request): Promise<Response> =>
    withDoor(
      req,
      {
        scopes: ['settings:read'],
        auth: deps.auth,
        cors: deps.cors,
        rateLimit: { identity: 'user', limit: deps.rateLimits?.read ?? 120 },
      },
      deps.door,
      async (ctx) => {
        const settings = sortSettings(await readAllSettings(deps.settings, ctx.caller));
        const categories = SETTINGS_CATEGORIES.map((category) => ({
          ...category,
          settings: settings.filter((setting) => setting.category === category.categoryKey),
        }));
        return { categories };
      },
    );
}

/**
 * PATCH /api/v1/settings/{key} — body `{ value }` only. Authorization (scopes
 * and super_admin-only keys) is enforced by the door and the settings service.
 */
export function patchSettingRoute(deps: SettingsRouteDeps) {
  return (req: Request, key: string): Promise<Response> =>
    withDoor(
      req,
      {
        scopes: ['settings:write'],
        auth: deps.auth,
        schema: patchSettingBodySchema,
        cors: deps.cors,
        rateLimit: { identity: 'user', limit: deps.rateLimits?.write ?? DEFAULT_WRITE_LIMIT },
      },
      deps.door,
      async (ctx) => {
        if (!KEY_PATTERN.test(key)) throw new DomainError('not_found');
        const { value } = ctx.body as { value: unknown };
        const setting = await writeSetting(deps.settings, ctx.caller, key, value);
        return { setting };
      },
    );
}

/**
 * PATCH /api/v1/settings — body `{ updates: [{ key, value }] }`.
 * Writes up to 30 settings in a single atomic transaction, reducing the
 * rate-limit impact from 12 separate calls (wizard) to just 1.
 */
export function patchSettingsRoute(deps: SettingsRouteDeps) {
  return (req: Request): Promise<Response> =>
    withDoor(
      req,
      {
        scopes: ['settings:write'],
        auth: deps.auth,
        schema: patchSettingsBodySchema,
        cors: deps.cors,
        rateLimit: { identity: 'user', limit: deps.rateLimits?.write ?? DEFAULT_WRITE_LIMIT },
      },
      deps.door,
      async (ctx) => {
        const { updates } = ctx.body as { updates: Array<{ key: string; value: unknown }> };
        for (const { key } of updates) {
          if (!KEY_PATTERN.test(key)) {
            throw new DomainError('not_found');
          }
        }
        const settings = await writeSettings(deps.settings, ctx.caller, updates);
        return { settings };
      },
    );
}
