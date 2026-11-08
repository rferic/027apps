import { z } from "zod";
import { withDoor } from "../api/door";
import { pageParams } from "../api/pagination";
import { DEFAULT_READ_LIMIT, DEFAULT_WRITE_LIMIT } from "../api/rate-limits";
import { DomainError } from "../errors";
import type { Caller, CorsOptions, DoorDeps } from "../api/types";
import {
  createApiKey,
  getApiKey,
  listApiKeys,
  revokeApiKey,
  updateApiKey,
  type ApiKeysDeps,
  type UpdateApiKeyInput,
} from "./service";

/**
 * API keys (core-api spec §3.6). The secret is returned once on creation and
 * never appears in a list or detail response. Service keys are super_admin
 * only; delegated keys belong to their user.
 */
export interface ApiKeysRouteDeps {
  door: DoorDeps;
  auth: (req: Request) => Promise<Caller>;
  apiKeys: ApiKeysDeps;
  cors?: CorsOptions;
  rateLimits?: { read?: number; write?: number };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * `GET /api-keys` filters beyond pagination. `kind` defaults to `all` when
 * omitted; `user` selects the owner of delegated keys and cannot be combined
 * with `kind=service` (that pair could only return an empty list). `state`
 * is derived, not stored: a revoked key never counts as expired. It also
 * defaults to `all` because the API is generic; the panel always sends its own.
 */
export const apiKeyListFiltersSchema = z
  .object({
    kind: z.enum(["all", "service", "delegated"]).optional(),
    user: z.uuid().optional(),
    state: z.enum(["all", "active", "revoked", "expired"]).optional(),
  })
  .strict()
  .refine((value) => !(value.kind === "service" && value.user), {
    message: "user cannot be combined with kind=service",
  });

function listFilters(searchParams: URLSearchParams) {
  const filters = apiKeyListFiltersSchema.safeParse({
    kind: searchParams.get("kind") || undefined,
    user: searchParams.get("user") || undefined,
    state: searchParams.get("state") || undefined,
  });
  if (!filters.success) {
    throw new DomainError("validation_failed", "invalid kind, user or state filter");
  }
  return filters.data;
}

export const createApiKeySchema = z
  .object({
    kind: z.enum(["service", "delegated"]),
    name: z.string().trim().min(1).max(80),
    scopes: z.array(z.string()).min(1).max(100),
    role_cap: z.enum(["admin", "super_admin"]).optional(),
    /** Owner of a delegated key; only a super_admin session may send it. */
    user_id: z.uuid().optional(),
    expires_at: z.string().datetime().optional(),
  })
  .strict();

/**
 * `PATCH /api-keys/{id}`. `kind`, `role_cap` and `user_id` are immutable, so
 * `.strict()` rejects them; at least one editable field is required.
 * `expires_at: null` removes the expiry, making the key one that never expires.
 */
export const updateApiKeySchema = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    scopes: z.array(z.string()).min(1).max(100).optional(),
    expires_at: z.union([z.string().datetime(), z.null()]).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "at least one field is required",
  });

function uuid(value: string): string {
  if (!UUID.test(value)) throw new DomainError("validation_failed", "invalid api key id");
  return value;
}

function options(deps: ApiKeysRouteDeps, scopes: string[], schema?: z.ZodType) {
  return {
    scopes,
    auth: deps.auth,
    cors: deps.cors,
    ...(schema ? { schema } : {}),
    rateLimit: { identity: "user" as const, limit: deps.rateLimits?.write ?? DEFAULT_WRITE_LIMIT },
  };
}

function readOptions(deps: ApiKeysRouteDeps, scopes: string[]) {
  return {
    scopes,
    auth: deps.auth,
    cors: deps.cors,
    rateLimit: { identity: "user" as const, limit: deps.rateLimits?.read ?? DEFAULT_READ_LIMIT },
  };
}

export function apiKeysRoute(deps: ApiKeysRouteDeps) {
  return (req: Request): Promise<Response> =>
    withDoor(req, readOptions(deps, ["api_keys:read"]), deps.door, async (ctx) => {
      const page = pageParams(ctx.searchParams);
      const filters = listFilters(ctx.searchParams);
      const result = await listApiKeys(deps.apiKeys, ctx.caller, { ...filters, ...page });
      return { ...result, limit: page.limit, offset: page.offset };
    });
}

export function createApiKeyRoute(deps: ApiKeysRouteDeps) {
  return (req: Request): Promise<Response> =>
    withDoor(
      req,
      options(deps, ["api_keys:write"], createApiKeySchema),
      deps.door,
      async (ctx) => ({
        status: 201,
        body: await createApiKey(
          deps.apiKeys,
          ctx.caller,
          ctx.body as {
            kind: "service" | "delegated";
            name: string;
            scopes: string[];
            role_cap?: "admin" | "super_admin";
            user_id?: string;
            expires_at?: string;
          },
        ),
      }),
    );
}

export function apiKeyRoute(deps: ApiKeysRouteDeps) {
  return (req: Request, rawId: string): Promise<Response> =>
    withDoor(req, readOptions(deps, ["api_keys:read"]), deps.door, async (ctx) => ({
      api_key: await getApiKey(deps.apiKeys, ctx.caller, uuid(rawId)),
    }));
}

export function revokeApiKeyRoute(deps: ApiKeysRouteDeps) {
  return (req: Request, rawId: string): Promise<Response> =>
    withDoor(req, options(deps, ["api_keys:revoke"]), deps.door, async (ctx) => {
      await revokeApiKey(deps.apiKeys, ctx.caller, uuid(rawId));
      return new Response(null, { status: 204 });
    });
}

export function updateApiKeyRoute(deps: ApiKeysRouteDeps) {
  return (req: Request, rawId: string): Promise<Response> =>
    withDoor(
      req,
      options(deps, ["api_keys:write"], updateApiKeySchema),
      deps.door,
      async (ctx) => ({
        api_key: await updateApiKey(
          deps.apiKeys,
          ctx.caller,
          uuid(rawId),
          ctx.body as UpdateApiKeyInput,
        ),
      }),
    );
}
