import { z } from "zod";
import { withDoor } from "../api/door";
import { DEFAULT_READ_LIMIT, DEFAULT_WRITE_LIMIT } from "../api/rate-limits";
import { DomainError } from "../errors";
import type { Caller, CorsOptions, DoorDeps } from "../api/types";
import { SUPPORTED_LOCALES } from "../settings/catalog";
import {
  deactivateUser,
  getUser,
  listUserModules,
  listUsers,
  purgeUser,
  restoreUser,
  updateUser,
  type UserListFilters,
  type UserPatch,
  type UsersDeps,
} from "./service";

/**
 * Users API (docs/superpowers/specs/2026-10-26-core-api.md §3.2): reads for admins, profile edits with
 * `users:write`, role changes with `roles:assign` (admins never touch a
 * super_admin), soft deactivation with `users:deactivate` (super_admin only).
 */
export interface UsersRouteDeps {
  door: DoorDeps;
  auth: (req: Request) => Promise<Caller>;
  users: UsersDeps;
  cors?: CorsOptions;
  rateLimits?: { read?: number; write?: number };
}

const localeSchema = z.enum([...SUPPORTED_LOCALES] as [string, ...string[]]);
const timezoneSchema = z
  .string()
  .refine((tz) => Intl.supportedValuesOf("timeZone").includes(tz), "not a valid IANA timezone");

export const userPatchSchema = z
  .object({
    display_name: z.string().min(1).max(80).optional(),
    locale: localeSchema.optional(),
    timezone: timezoneSchema.optional(),
    theme: z.enum(["system", "light", "dark"]).optional(),
    role: z.enum(["super_admin", "admin", "user"]).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, { message: "at least one field is required" });

/**
 * `GET /users` filters beyond `q`: role, activation state and category.
 * Validated with zod at the edge, like every other filter, so an unknown value
 * is a 400 instead of silently returning the unfiltered list. Omitting `state`
 * means `active`; `all` is the explicit opt-out.
 */
export const userListFiltersSchema = z
  .object({
    role: z.enum(["super_admin", "admin", "user"]).optional(),
    state: z.enum(["active", "deactivated", "all"]).optional(),
    category: z.uuid().optional(),
  })
  .strict();

function pageParams(searchParams: URLSearchParams): UserListFilters {
  const q = searchParams.get("q")?.trim() || undefined;
  if (q && q.length > 100) throw new DomainError("validation_failed", "q is too long");
  const rawLimit = Number(searchParams.get("limit") ?? 50);
  const rawOffset = Number(searchParams.get("offset") ?? 0);
  const limit = Number.isFinite(rawLimit) ? Math.min(100, Math.max(1, rawLimit)) : 50;
  const offset = Number.isFinite(rawOffset) ? Math.max(0, rawOffset) : 0;

  const filters = userListFiltersSchema.safeParse({
    role: searchParams.get("role") || undefined,
    state: searchParams.get("state") || undefined,
    category: searchParams.get("category") || undefined,
  });
  if (!filters.success) {
    throw new DomainError("validation_failed", "invalid role, state or category filter");
  }

  return {
    ...(q ? { q } : {}),
    ...(filters.data.role ? { role: filters.data.role } : {}),
    ...(filters.data.state ? { state: filters.data.state } : {}),
    ...(filters.data.category ? { category: filters.data.category } : {}),
    limit,
    offset,
  };
}

/** Path ids are uuids, like every other profile reference in the API. */
function userId(value: string): string {
  if (!z.uuid().safeParse(value).success) {
    throw new DomainError("validation_failed", "invalid user id");
  }
  return value;
}

/** GET /api/v1/users — list with `q`, `role`, `state`, `category`, `limit`, `offset`. */
export function usersRoute(deps: UsersRouteDeps) {
  return (req: Request): Promise<Response> =>
    withDoor(
      req,
      {
        scopes: ["users:read"],
        auth: deps.auth,
        cors: deps.cors,
        rateLimit: { identity: "user", limit: deps.rateLimits?.read ?? DEFAULT_READ_LIMIT },
      },
      deps.door,
      async (ctx) => {
        const page = pageParams(ctx.searchParams);
        const result = await listUsers(deps.users, ctx.caller, page);
        return { ...result, limit: page.limit, offset: page.offset };
      },
    );
}

/** GET /api/v1/users/{id} — user detail. */
export function userRoute(deps: UsersRouteDeps) {
  return (req: Request, id: string): Promise<Response> =>
    withDoor(
      req,
      {
        scopes: ["users:read"],
        auth: deps.auth,
        cors: deps.cors,
        rateLimit: { identity: "user", limit: deps.rateLimits?.read ?? DEFAULT_READ_LIMIT },
      },
      deps.door,
      async () => ({ user: await getUser(deps.users, id) }),
    );
}

/**
 * GET /api/v1/users/{id}/modules — modules granted to a profile (live grants
 * only). The panel uses it to offer per-module permissions when it creates or
 * edits a delegated API key.
 */
export function userModulesRoute(deps: UsersRouteDeps) {
  return (req: Request, id: string): Promise<Response> =>
    withDoor(
      req,
      {
        scopes: ["users:read"],
        auth: deps.auth,
        cors: deps.cors,
        rateLimit: { identity: "user", limit: deps.rateLimits?.read ?? DEFAULT_READ_LIMIT },
      },
      deps.door,
      async (ctx) => ({
        modules: await listUserModules(deps.users, ctx.caller, userId(id)),
      }),
    );
}

/** PATCH /api/v1/users/{id} — profile fields and, with `roles:assign`, role. */
export function updateUserRoute(deps: UsersRouteDeps) {
  return (req: Request, id: string): Promise<Response> =>
    withDoor(
      req,
      {
        // Role changes additionally require `roles:assign`, enforced by the
        // service (admins can never touch a super_admin role).
        scopes: ["users:write"],
        auth: deps.auth,
        cors: deps.cors,
        schema: userPatchSchema,
        rateLimit: { identity: "user", limit: deps.rateLimits?.write ?? DEFAULT_WRITE_LIMIT },
      },
      deps.door,
      async (ctx) => ({
        user: await updateUser(deps.users, ctx.caller, id, ctx.body as UserPatch),
      }),
    );
}

/** DELETE /api/v1/users/{id} — soft deactivation (super_admin only). */
export function deactivateUserRoute(deps: UsersRouteDeps) {
  return (req: Request, id: string): Promise<Response> =>
    withDoor(
      req,
      {
        scopes: ["users:deactivate"],
        auth: deps.auth,
        cors: deps.cors,
        rateLimit: { identity: "user", limit: deps.rateLimits?.write ?? DEFAULT_WRITE_LIMIT },
      },
      deps.door,
      async (ctx) => ({ user: await deactivateUser(deps.users, ctx.caller, id) }),
    );
}

/** POST /api/v1/users/{id}/restore — undo a soft deactivation (super_admin only). */
export function restoreUserRoute(deps: UsersRouteDeps) {
  return (req: Request, id: string): Promise<Response> =>
    withDoor(
      req,
      {
        scopes: ["users:deactivate"],
        auth: deps.auth,
        cors: deps.cors,
        rateLimit: { identity: "user", limit: deps.rateLimits?.write ?? DEFAULT_WRITE_LIMIT },
      },
      deps.door,
      async (ctx) => ({ user: await restoreUser(deps.users, ctx.caller, id) }),
    );
}

/**
 * DELETE /api/v1/users/{id}/purge — irreversible physical deletion
 * (super_admin only). The profile must already be deactivated; 204 has no body.
 */
export function purgeUserRoute(deps: UsersRouteDeps) {
  return (req: Request, id: string): Promise<Response> =>
    withDoor(
      req,
      {
        scopes: ["users:deactivate"],
        auth: deps.auth,
        cors: deps.cors,
        rateLimit: { identity: "user", limit: deps.rateLimits?.write ?? DEFAULT_WRITE_LIMIT },
      },
      deps.door,
      async (ctx) => {
        await purgeUser(deps.users, ctx.caller, id);
        return new Response(null, { status: 204 });
      },
    );
}
