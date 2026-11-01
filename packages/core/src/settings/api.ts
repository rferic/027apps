/**
 * Settings API routes (instance-config spec §6): reads for admins (masked
 * secrets) and value-only PATCH with catalog validation and super_admin rules
 * for `security.*`, `instance.public_url` and `cors_allowlist`.
 */

import { z } from 'zod';
import { withDoor } from '../api/door';
import { authorize } from '../auth/guard';
import { DomainError } from '../errors';
import type { Caller, DoorDeps } from '../api/types';
import { SETTINGS_CATEGORIES } from './catalog';
import { readAllSettings, writeSetting, type SettingView, type SettingsDeps } from './service';

export interface SettingsRouteDeps {
  door: DoorDeps;
  auth: (req: Request) => Promise<Caller>;
  settings: SettingsDeps;
}

/** Canonical key: `<category>.<name>` (e.g. `instance.name`). */
const KEY_PATTERN = /^[a-z][a-z0-9_]*(\.[a-z0-9_]+)+$/;

const patchBodySchema = z.object({ value: z.unknown() }).strict();

function sortSettings(settings: SettingView[]): SettingView[] {
  return settings.sort((a, b) => a.sortOrder - b.sortOrder || a.key.localeCompare(b.key));
}

/** GET /api/v1/settings — all settings, secrets masked as `configured`. */
export function settingsRoute(deps: SettingsRouteDeps) {
  return (req: Request): Promise<Response> =>
    withDoor(req, { scopes: ['settings:read'], auth: deps.auth }, deps.door, async (ctx) => {
      authorize(ctx.caller, ['settings:read']);
      const settings = sortSettings(await readAllSettings(deps.settings));
      return { settings };
    });
}

/** GET /api/v1/settings-categories — categories with their settings, by sort order. */
export function settingsCategoriesRoute(deps: SettingsRouteDeps) {
  return (req: Request): Promise<Response> =>
    withDoor(req, { scopes: ['settings:read'], auth: deps.auth }, deps.door, async (ctx) => {
      authorize(ctx.caller, ['settings:read']);
      const settings = sortSettings(await readAllSettings(deps.settings));
      const categories = SETTINGS_CATEGORIES.map((category) => ({
        ...category,
        settings: settings.filter((setting) => setting.category === category.categoryKey),
      }));
      return { categories };
    });
}

/**
 * PATCH /api/v1/settings/{key} — body `{ value }` only. Authorization (scopes
 * and super_admin-only keys) is enforced by the settings service.
 */
export function patchSettingRoute(deps: SettingsRouteDeps) {
  return (req: Request, key: string): Promise<Response> =>
    withDoor(req, { scopes: ['settings:write'], auth: deps.auth, schema: patchBodySchema }, deps.door, async (ctx) => {
      authorize(ctx.caller, ['settings:write']);
      if (!KEY_PATTERN.test(key)) throw new DomainError('not_found');
      const { value } = ctx.body as { value: unknown };
      const setting = await writeSetting(deps.settings, ctx.caller, key, value);
      return { setting };
    });
}
