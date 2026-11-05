import { z } from "zod";
import { withDoor } from "../api/door";
import { DomainError } from "../errors";
import type { Caller, CorsOptions, DoorDeps } from "../api/types";
import {
  activateModule,
  deactivateModule,
  getModule,
  getModuleSettings,
  grantUserModule,
  installModule,
  listModules,
  revokeUserModule,
  uninstallModule,
  updateModule,
  updateModuleSetting,
  type ModulesDeps,
} from "./service";

/**
 * Modules API (core-api spec §3.4). The manifest is loaded server-side from the
 * trusted package: the install/uninstall bodies never carry DDL.
 */
export interface ModulesRouteDeps {
  door: DoorDeps;
  auth: (req: Request) => Promise<Caller>;
  modules: ModulesDeps;
  /** Loads the packaged manifest by module key, or null when it does not exist. */
  manifest: (key: string) => Promise<unknown | null>;
  cors?: CorsOptions;
  rateLimits?: { read?: number; write?: number };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MODULE_KEY = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const emptySchema = z.object({}).strict().optional();
const uninstallSchema = z.object({ confirm: z.boolean().optional() }).strict().optional();
const updateSchema = z
  .object({
    is_public: z.boolean().optional(),
    mcp_exposed: z.enum(["none", "read", "read_write"]).optional(),
  })
  .strict();
const settingSchema = z.object({ key: z.string().trim().min(1).max(200), value: z.unknown() }).strict();

function moduleKey(value: string): string {
  if (!MODULE_KEY.test(value)) throw new DomainError("validation_failed", "invalid module key");
  return value;
}

function uuid(value: string, field: string): string {
  if (!UUID.test(value)) throw new DomainError("validation_failed", `invalid ${field}`);
  return value;
}

function options(deps: ModulesRouteDeps, scopes: string[], schema?: z.ZodType) {
  return {
    scopes,
    auth: deps.auth,
    cors: deps.cors,
    ...(schema ? { schema } : {}),
    rateLimit: { identity: "user" as const, limit: deps.rateLimits?.write ?? 10 },
  };
}

function readOptions(deps: ModulesRouteDeps, scopes: string[]) {
  return {
    scopes,
    auth: deps.auth,
    cors: deps.cors,
    rateLimit: { identity: "user" as const, limit: deps.rateLimits?.read ?? 120 },
  };
}

async function loadManifest(deps: ModulesRouteDeps, key: string): Promise<unknown> {
  const manifest = await deps.manifest(key);
  if (!manifest) throw new DomainError("not_found");
  return manifest;
}

export function modulesRoute(deps: ModulesRouteDeps) {
  return (req: Request): Promise<Response> =>
    withDoor(req, readOptions(deps, ["modules:read"]), deps.door, async () => ({
      modules: await listModules(deps.modules),
    }));
}

export function moduleRoute(deps: ModulesRouteDeps) {
  return (req: Request, rawKey: string): Promise<Response> =>
    withDoor(req, readOptions(deps, ["modules:read"]), deps.door, async (ctx) => ({
      module: await getModule(deps.modules, ctx.caller, moduleKey(rawKey)),
    }));
}

export function updateModuleRoute(deps: ModulesRouteDeps) {
  return (req: Request, rawKey: string): Promise<Response> =>
    withDoor(
      req,
      options(deps, ["modules:manage"], updateSchema),
      deps.door,
      async (ctx) => ({
        module: await updateModule(
          deps.modules,
          ctx.caller,
          moduleKey(rawKey),
          ctx.body as { is_public?: boolean; mcp_exposed?: "none" | "read" | "read_write" },
        ),
      }),
    );
}

export function installModuleRoute(deps: ModulesRouteDeps) {
  return (req: Request, rawKey: string): Promise<Response> =>
    withDoor(
      req,
      options(deps, ["modules:manage"], emptySchema),
      deps.door,
      async (ctx) => ({
        status: 201,
        body: {
          module: await installModule(
            deps.modules,
            ctx.caller,
            await loadManifest(deps, moduleKey(rawKey)),
          ),
        },
      }),
    );
}

export function activateModuleRoute(deps: ModulesRouteDeps) {
  return (req: Request, rawKey: string): Promise<Response> =>
    withDoor(req, options(deps, ["modules:manage"], emptySchema), deps.door, async (ctx) => ({
      module: await activateModule(deps.modules, ctx.caller, moduleKey(rawKey)),
    }));
}

export function deactivateModuleRoute(deps: ModulesRouteDeps) {
  return (req: Request, rawKey: string): Promise<Response> =>
    withDoor(req, options(deps, ["modules:manage"], emptySchema), deps.door, async (ctx) => ({
      module: await deactivateModule(deps.modules, ctx.caller, moduleKey(rawKey)),
    }));
}

export function uninstallModuleRoute(deps: ModulesRouteDeps) {
  return (req: Request, rawKey: string): Promise<Response> =>
    withDoor(
      req,
      options(deps, ["modules:manage"], uninstallSchema),
      deps.door,
      async (ctx) => {
        const key = moduleKey(rawKey);
        const body = (ctx.body ?? {}) as { confirm?: boolean };
        await uninstallModule(
          deps.modules,
          ctx.caller,
          key,
          await loadManifest(deps, key),
          body.confirm === true,
        );
        return new Response(null, { status: 204 });
      },
    );
}

export function moduleSettingsRoute(deps: ModulesRouteDeps) {
  return (req: Request, rawKey: string): Promise<Response> =>
    withDoor(
      req,
      readOptions(deps, ["modules:read", "settings:read"]),
      deps.door,
      async (ctx) => ({
        settings: await getModuleSettings(deps.modules, ctx.caller, moduleKey(rawKey)),
      }),
    );
}

export function updateModuleSettingRoute(deps: ModulesRouteDeps) {
  return (req: Request, rawKey: string): Promise<Response> =>
    withDoor(
      req,
      options(deps, ["modules:manage", "settings:write"], settingSchema),
      deps.door,
      async (ctx) => ({
        setting: await updateModuleSetting(
          deps.modules,
          ctx.caller,
          moduleKey(rawKey),
          ctx.body as { key: string; value: unknown },
        ),
      }),
    );
}

export function grantUserModuleRoute(deps: ModulesRouteDeps) {
  return (req: Request, userId: string, rawKey: string): Promise<Response> =>
    withDoor(req, options(deps, ["modules:grant"], emptySchema), deps.door, async (ctx) => {
      const key = moduleKey(rawKey);
      await grantUserModule(deps.modules, ctx.caller, uuid(userId, "user id"), key);
      return new Response(null, { status: 204 });
    });
}

export function revokeUserModuleRoute(deps: ModulesRouteDeps) {
  return (req: Request, userId: string, rawKey: string): Promise<Response> =>
    withDoor(req, options(deps, ["modules:grant"]), deps.door, async (ctx) => {
      const key = moduleKey(rawKey);
      await revokeUserModule(deps.modules, ctx.caller, uuid(userId, "user id"), key);
      return new Response(null, { status: 204 });
    });
}
