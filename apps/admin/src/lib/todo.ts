import { withDoor } from "@027apps/core/api/door.js";
import { getInfra, runInTransaction } from "@/lib/api/door";
import { DomainError, type DomainErrorCode } from "@027apps/core/errors.js";
import type { ZodType } from "zod";
import { ZodError } from "zod";
import type { JsonValue, RequestContext } from "@027apps/core/api/types.js";
import { TodoDomainError } from "@027apps/todo/domain/errors.js";
import type { Caller } from "@027apps/todo/domain/groups.js";
import type { TodoDeps } from "@027apps/todo/domain/types.js";

/**
 * NotNow speaks through the door with its own module scopes, never Core roles.
 * Groups and tasks belong to this module: no id, member or scope is shared with
 * OweNo or the Core.
 */

/** The module's codes mapped onto the Core envelope (spec §6). */
const STATUS: Readonly<Record<TodoDomainError["code"], DomainErrorCode>> = {
  not_found: "not_found",
  forbidden: "insufficient_scope",
  not_assignee: "insufficient_scope",
  personal_group: "insufficient_scope",
  last_owner: "insufficient_scope",
  validation_failed: "validation_failed",
  power_disabled: "validation_failed",
  already_assigned: "conflict",
  task_done: "conflict",
  task_pending: "conflict",
  request_exists: "conflict",
  request_expired: "conflict",
  season_closed: "conflict",
};

export function mapError(error: unknown): unknown {
  if (error instanceof TodoDomainError) {
    return new DomainError(STATUS[error.code] ?? "internal", error.message, {
      code: error.code,
      ...error.details,
    });
  }
  return error;
}

export interface TodoHandlerArgs {
  todo: TodoDeps;
  caller: Caller;
  ctx: RequestContext;
}

interface RouteOptions {
  scopes: string[];
  rateLimit: { identity: "user" | "ip" | "key"; limit: number; windowSeconds?: number; bucket?: string };
  schema?: ZodType;
  /** Routes whose behaviour depends on the module's settings read them here. */
  moduleSettings?: boolean;
}

/** The two instance settings the domain reads; stored as JSON values. */
async function moduleSettings(db: {
  query(sql: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
}): Promise<{ requestTtlHours?: number; defaultPower?: number | null }> {
  const { rows } = await db.query(
    `select key, value from public.settings
      where key in ('todo.request_ttl_hours', 'todo.default_power')`,
  );
  const value = (key: string) => {
    const row = rows.find((candidate) => candidate.key === key);
    return typeof row?.value === "number" ? row.value : undefined;
  };
  const ttl = value("todo.request_ttl_hours");
  const power = value("todo.default_power");
  return {
    ...(ttl !== undefined ? { requestTtlHours: ttl } : {}),
    ...(power !== undefined ? { defaultPower: power } : {}),
  };
}

function toCaller(caller: RequestContext["caller"]): Caller {
  if (caller.kind === "session") return { userId: caller.userId, role: caller.role };
  // A delegated key carries the role it was capped to.
  if (caller.kind === "delegated") return { userId: caller.userId, role: caller.roleCap };
  throw new DomainError("insufficient_scope");
}

/** One route: the door enforces module, scope and rate limit; the domain decides. */
export function handle(
  req: Request,
  options: RouteOptions,
  fn: (args: TodoHandlerArgs) => Promise<JsonValue>,
): Promise<Response> {
  return (async () => {
    const { deps, auth, settingsDeps } = await getInfra();
    const settings = options.moduleSettings ? await moduleSettings(settingsDeps.db) : {};
    return withDoor(
      req,
      { ...options, moduleKey: "todo", auth },
      deps,
      async (ctx) =>
        fn({
          todo: { db: settingsDeps.db, withTransaction: runInTransaction, ...settings },
          caller: toCaller(ctx.caller),
          ctx,
        }).catch((error: unknown) => {
          throw mapError(error);
        }),
    );
  })();
}

export function json<T>(value: T): JsonValue {
  return value as unknown as JsonValue;
}

/** The caller's timezone and locale seed a new group; never trusted from the body. */
export async function profileContext(
  todo: TodoDeps,
  userId: string,
): Promise<{ timezone: string; locale: string }> {
  const { rows } = await todo.db.query(
    "select timezone, locale from public.profiles where id = $1",
    [userId],
  );
  const timezone = rows[0]?.timezone;
  const locale = rows[0]?.locale;
  return {
    timezone: typeof timezone === "string" && timezone.length > 0 ? timezone : "Europe/Madrid",
    locale: typeof locale === "string" ? locale : "es",
  };
}

/** The personal group is the only name the server can translate on its own. */
const PERSONAL: Readonly<Record<string, string>> = {
  en: "Personal",
  es: "Personal",
  ca: "Personal",
  gl: "Persoal",
  pt: "Pessoal",
  it: "Personale",
  fr: "Personnel",
  de: "Persönlich",
  eu: "Pertsonala",
};

export function personalName(locale: string): string {
  return PERSONAL[locale.slice(0, 2)] ?? PERSONAL.en!;
}

/**
 * `Idempotency-Key` is mandatory on the three writes that create something
 * (spec §6). A client that forgot it gets a uniform validation error instead of
 * a silently non-idempotent write.
 */
export function idempotencyKey(req: Request): string {
  const key = req.headers.get("idempotency-key")?.trim() ?? "";
  if (key === "") {
    throw new DomainError("validation_failed", "Idempotency-Key header is required");
  }
  return key;
}

/** Query strings reach the domain parsed and validated, never as raw strings. */
export function parseQuery<T>(schema: ZodType<T>, req: Request): T {
  try {
    return schema.parse(Object.fromEntries(new URL(req.url).searchParams));
  } catch (error) {
    if (error instanceof ZodError) {
      throw new DomainError("validation_failed", "Invalid query", { issues: error.issues.length });
    }
    throw error;
  }
}
