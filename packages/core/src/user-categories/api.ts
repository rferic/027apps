import { z } from "zod";
import { withDoor } from "../api/door";
import { pageParams } from "../api/pagination";
import { DEFAULT_READ_LIMIT, DEFAULT_WRITE_LIMIT } from "../api/rate-limits";
import { DomainError } from "../errors";
import type { Caller, CorsOptions, DoorDeps, RequestContext } from "../api/types";
import {
  addMember,
  assignModule,
  createCategory,
  deleteCategory,
  getCategory,
  listCategories,
  removeMember,
  renameCategory,
  unassignModule,
  type UserCategoriesDeps,
} from "./service";

/**
 * User categories API (core-api spec §3.3): admins manage categories, members
 * and the bulk module template. Assigning a module materialises `user_modules`
 * for the current members; unassigning never revokes the materialised grants.
 */
export interface UserCategoriesRouteDeps {
  door: DoorDeps;
  auth: (req: Request) => Promise<Caller>;
  categories: UserCategoriesDeps;
  cors?: CorsOptions;
  rateLimits?: { read?: number; write?: number };
}

const NAME = z.string().trim().min(1).max(80);
const SLUG = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).max(80);
const MODULE_KEY = /^[a-z0-9][a-z0-9_-]{0,63}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const userCategoryCreateSchema = z.object({ name: NAME, slug: SLUG.optional() }).strict();
export const userCategoryRenameSchema = z.object({ name: NAME }).strict();
export const userCategoryEmptySchema = z.object({}).strict().optional();

function moduleKey(value: string): string {
  if (!MODULE_KEY.test(value)) throw new DomainError("validation_failed", "invalid module key");
  return value;
}

/** Route params reach Postgres as uuid columns: reject malformed ids as 400, not 500. */
function uuid(value: string, field: string): string {
  if (!UUID.test(value)) throw new DomainError("validation_failed", `invalid ${field}`);
  return value;
}

function options(deps: UserCategoriesRouteDeps, scopes: string[], schema?: z.ZodType) {
  return {
    scopes,
    auth: deps.auth,
    cors: deps.cors,
    ...(schema ? { schema } : {}),
    rateLimit: { identity: "user" as const, limit: deps.rateLimits?.write ?? DEFAULT_WRITE_LIMIT },
  };
}

function readOptions(deps: UserCategoriesRouteDeps, scopes: string[]) {
  return {
    scopes,
    auth: deps.auth,
    cors: deps.cors,
    rateLimit: { identity: "user" as const, limit: deps.rateLimits?.read ?? DEFAULT_READ_LIMIT },
  };
}

export function userCategoriesRoute(deps: UserCategoriesRouteDeps) {
  return (req: Request): Promise<Response> =>
    withDoor(req, readOptions(deps, ["user_categories:read"]), deps.door, async (ctx) => {
      const page = pageParams(ctx.searchParams);
      const result = await listCategories(deps.categories, page);
      return { ...result, limit: page.limit, offset: page.offset };
    });
}

export function createUserCategoryRoute(deps: UserCategoriesRouteDeps) {
  return (req: Request): Promise<Response> =>
    withDoor(
      req,
      options(deps, ["user_categories:write"], userCategoryCreateSchema),
      deps.door,
      async (ctx) => ({
        status: 201,
        body: {
          category: await createCategory(
            deps.categories,
            ctx.caller,
            ctx.body as { name: string; slug?: string },
          ),
        },
      }),
    );
}

export function userCategoryRoute(deps: UserCategoriesRouteDeps) {
  return (req: Request, rawId: string): Promise<Response> =>
    withDoor(req, readOptions(deps, ["user_categories:read"]), deps.door, async () => ({
      category: await getCategory(deps.categories, uuid(rawId, "category id")),
    }));
}

export function renameUserCategoryRoute(deps: UserCategoriesRouteDeps) {
  return (req: Request, rawId: string): Promise<Response> =>
    withDoor(
      req,
      options(deps, ["user_categories:write"], userCategoryRenameSchema),
      deps.door,
      async (ctx) => ({
        category: await renameCategory(
          deps.categories,
          uuid(rawId, "category id"),
          (ctx.body as { name: string }).name,
        ),
      }),
    );
}

export function deleteUserCategoryRoute(deps: UserCategoriesRouteDeps) {
  return (req: Request, rawId: string): Promise<Response> =>
    withDoor(req, options(deps, ["user_categories:write"]), deps.door, async () => {
      await deleteCategory(deps.categories, uuid(rawId, "category id"));
      return new Response(null, { status: 204 });
    });
}

export function addCategoryMemberRoute(deps: UserCategoriesRouteDeps) {
  return (req: Request, rawId: string, rawUserId: string): Promise<Response> =>
    withDoor(req, options(deps, ["user_categories:write"], userCategoryEmptySchema), deps.door, async () => {
      await addMember(
        deps.categories,
        uuid(rawId, "category id"),
        uuid(rawUserId, "user id"),
      );
      return new Response(null, { status: 204 });
    });
}

export function removeCategoryMemberRoute(deps: UserCategoriesRouteDeps) {
  return (req: Request, rawId: string, rawUserId: string): Promise<Response> =>
    withDoor(req, options(deps, ["user_categories:write"]), deps.door, async () => {
      await removeMember(
        deps.categories,
        uuid(rawId, "category id"),
        uuid(rawUserId, "user id"),
      );
      return new Response(null, { status: 204 });
    });
}

export function categoryModulesRoute(deps: UserCategoriesRouteDeps) {
  return (req: Request, rawId: string): Promise<Response> =>
    withDoor(
      req,
      readOptions(deps, ["user_categories:read", "modules:read"]),
      deps.door,
      async () => ({
        modules: (await getCategory(deps.categories, uuid(rawId, "category id"))).modules,
      }),
    );
}

export function assignCategoryModuleRoute(deps: UserCategoriesRouteDeps) {
  return (req: Request, rawId: string, key: string): Promise<Response> =>
    withDoor(
      req,
      options(deps, ["user_categories:write", "modules:grant"], userCategoryEmptySchema),
      deps.door,
      async (ctx: RequestContext) => ({
        modules: await assignModule(
          deps.categories,
          ctx.caller,
          uuid(rawId, "category id"),
          moduleKey(key),
        ),
      }),
    );
}

export function unassignCategoryModuleRoute(deps: UserCategoriesRouteDeps) {
  return (req: Request, rawId: string, key: string): Promise<Response> =>
    withDoor(
      req,
      options(deps, ["user_categories:write", "modules:grant"]),
      deps.door,
      async () => ({
        modules: await unassignModule(
          deps.categories,
          uuid(rawId, "category id"),
          moduleKey(key),
        ),
      }),
    );
}
