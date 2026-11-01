/**
 * Instance and health API routes (instance-config spec §7, core-api spec §3):
 * public doors with per-IP rate limiting. `/instance` exposes only public
 * settings plus the derived setup state; `/health` answers 200 ok or 503
 * degraded with a 30 s cache.
 */

import { withDoor } from '../api/door';
import type { Caller, CorsOptions, DoorDeps } from '../api/types';
import { computeHealth, readPublicSettings, type SettingsDeps } from '../settings/service';

export interface InstanceRouteDeps {
  door: DoorDeps;
  auth: (req: Request) => Promise<Caller>;
  settings: SettingsDeps;
  /** Deployed Core version (package.json). */
  version: string;
  cors?: CorsOptions;
  rateLimits?: { public?: number; write?: number };
}

/** Required keys once an admin exists (instance-config §7: setup_incomplete). */
const REQUIRED_SETUP_KEYS = [
  'instance.public_url',
  'localization.default_locale',
  'localization.timezone',
  'localization.default_currency',
] as const;

async function hasActiveSuperAdmin(deps: InstanceRouteDeps): Promise<boolean> {
  const { rows } = await deps.settings.db.query(
    "select 1 from public.profiles where role = 'super_admin' and deactivated_at is null limit 1",
  );
  return rows.length > 0;
}

function missingRequired(settingsPublic: Record<string, unknown>): string[] {
  return REQUIRED_SETUP_KEYS.filter((key) => {
    const value = settingsPublic[key];
    return value === null || value === undefined || value === '';
  });
}

/** GET /api/v1/instance — public metadata plus public settings. */
export function instanceRoute(deps: InstanceRouteDeps) {
  return (req: Request): Promise<Response> =>
    withDoor(
      req,
      {
        scopes: [],
        auth: deps.auth,
        cors: deps.cors,
        rateLimit: { identity: 'ip', limit: deps.rateLimits?.public ?? 30 },
      },
      deps.door,
      async () => {
        const [settingsPublic, superAdminExists] = await Promise.all([
          readPublicSettings(deps.settings),
          hasActiveSuperAdmin(deps),
        ]);
        return {
          version: deps.version,
          requires_setup: !superAdminExists,
          setup_incomplete: superAdminExists && missingRequired(settingsPublic).length > 0,
          settings_public: settingsPublic,
        };
      },
    );
}

/** GET /api/v1/health — 200 ok or 503 degraded, cached 30 s. */
export function healthRoute(deps: InstanceRouteDeps) {
  return (req: Request): Promise<Response> =>
    withDoor(
      req,
      {
        scopes: [],
        auth: deps.auth,
        cors: deps.cors,
        rateLimit: { identity: 'ip', limit: deps.rateLimits?.public ?? 30 },
      },
      deps.door,
      async () => {
        const health = await computeHealth(deps.settings);
        const body =
          health.status === 'degraded'
            ? { status: 'degraded', degradedReasons: health.degradedReasons }
            : { status: 'ok' };
        return new Response(JSON.stringify(body), {
          status: health.status === 'ok' ? 200 : 503,
          headers: { 'cache-control': 'public, max-age=30' },
        });
      },
    );
}
