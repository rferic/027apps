import { DomainError } from "../errors";
import { enqueueEvent } from "../realtime/service";
import type { Caller } from "../api/types";
import type { QueryClient } from "../api/rate-limit-storage";

/**
 * Users and roles (docs/superpowers/specs/2026-10-26-core-api.md §3.2).
 *
 * Invariants live here, not in the route: the root (the first super_admin
 * created by /setup) cannot be demoted or deactivated, the instance never
 * loses its last active super_admin, and an admin can never change a
 * super_admin *role*. Profile fields of a super_admin remain editable by an
 * admin, as the spec requires (`is_admin()` on PATCH).
 *
 * Role changes and deactivations run in one transaction with an advisory lock:
 * two concurrent requests cannot both pass the "last super_admin" check.
 * Conflict messages are diagnostic only; the API envelope emits the canonical
 * message for the error code, never this text.
 */
export type Role = "super_admin" | "admin" | "user";

export interface UsersDeps {
  db: QueryClient;
  /** Runs the invariants + write in one transaction (injected by the app). */
  withTransaction?: <T>(fn: (db: QueryClient) => Promise<T>) => Promise<T>;
}

export type UserView = {
  id: string;
  display_name: string;
  locale: string;
  timezone: string;
  role: Role;
  created_at: string;
  deactivated_at: string | null;
};

export interface UserListFilters {
  q?: string;
  limit: number;
  offset: number;
}

export interface UserList {
  users: UserView[];
  /** Profiles matching the filter, across every page. */
  total: number;
  /** Active (not deactivated) profiles matching the filter, across every page. */
  active_total: number;
}

export interface UserPatch {
  display_name?: string;
  locale?: string;
  timezone?: string;
  role?: Role;
}

const ROLE_LOCK = "select pg_advisory_xact_lock(hashtext('core_users_roles'))";

const toIso = (value: unknown): string | null =>
  value instanceof Date ? value.toISOString() : typeof value === "string" ? value : null;

function toView(row: Record<string, unknown>): UserView {
  return {
    id: String(row.id),
    display_name: String(row.display_name),
    locale: String(row.locale),
    timezone: String(row.timezone),
    role: row.role as Role,
    created_at: toIso(row.created_at) ?? new Date(0).toISOString(),
    deactivated_at: toIso(row.deactivated_at),
  };
}

/** Escape `%`, `_` and `\` so `q` is a literal ILIKE pattern. */
function likePattern(q: string): string {
  return `%${q.replace(/[\\%_]/g, "\\$&")}%`;
}

async function getUserFrom(db: QueryClient, id: string): Promise<UserView> {
  const { rows } = await db.query(
    "select id, display_name, locale, timezone, role, created_at, deactivated_at from public.profiles where id = $1",
    [id],
  );
  if (!rows[0]) throw new DomainError("not_found");
  return toView(rows[0]);
}

/** The root is the first (oldest active) super_admin created by /setup. */
async function rootUserId(db: QueryClient): Promise<string | null> {
  const { rows } = await db.query(
    "select id from public.profiles where role = 'super_admin' and deactivated_at is null order by created_at asc, id asc limit 1",
  );
  return rows[0] ? String(rows[0].id) : null;
}

async function activeSuperAdmins(db: QueryClient): Promise<number> {
  const { rows } = await db.query(
    "select count(*)::int as n from public.profiles where role = 'super_admin' and deactivated_at is null",
  );
  return Number(rows[0]?.n ?? 0);
}

export async function listUsers(deps: UsersDeps, filters: UserListFilters): Promise<UserList> {
  const pattern = filters.q ? likePattern(filters.q) : null;
  const { rows } = await deps.db.query(
    `select p.id, p.display_name, p.locale, p.timezone, p.role, p.created_at, p.deactivated_at
       from public.profiles p
       join auth.users u on u.id = p.id
      where ($1::text is null or p.display_name ilike $1 escape '\\' or u.email ilike $1 escape '\\')
      order by p.created_at asc, p.id asc
      limit $2 offset $3`,
    [pattern, filters.limit, filters.offset],
  );
  const { rows: countRows } = await deps.db.query(
    `select count(*)::int as n,
            count(*) filter (where p.deactivated_at is null)::int as active_total
       from public.profiles p
       join auth.users u on u.id = p.id
      where ($1::text is null or p.display_name ilike $1 escape '\\' or u.email ilike $1 escape '\\')`,
    [pattern],
  );
  return {
    users: rows.map(toView),
    total: Number(countRows[0]?.n ?? 0),
    active_total: Number(countRows[0]?.active_total ?? 0),
  };
}

export async function getUser(deps: UsersDeps, id: string): Promise<UserView> {
  return getUserFrom(deps.db, id);
}

async function assertRoleChangeAllowed(
  db: QueryClient,
  caller: Caller,
  current: UserView,
  nextRole: Role,
): Promise<void> {
  if (caller.kind !== "session") throw new DomainError("insufficient_scope");
  if (nextRole === current.role) return;

  // Admins manage admins/users but never change a super_admin role.
  if (caller.role === "admin") {
    if (current.role === "super_admin" || nextRole === "super_admin") {
      throw new DomainError("insufficient_scope");
    }
    return;
  }
  if (caller.role !== "super_admin") throw new DomainError("insufficient_scope");

  if ((await rootUserId(db)) === current.id) {
    throw new DomainError("conflict", "The root user cannot be demoted");
  }
  if (current.role === "super_admin" && (await activeSuperAdmins(db)) <= 1) {
    throw new DomainError("conflict", "The instance needs at least one active super_admin");
  }
}

/** One transaction with a role advisory lock (falls back to the client). */
async function withRoleLock<T>(
  deps: UsersDeps,
  fn: (db: QueryClient) => Promise<T>,
): Promise<T> {
  if (!deps.withTransaction) return fn(deps.db);
  return deps.withTransaction(async (db) => {
    await db.query("BEGIN");
    try {
      await db.query(ROLE_LOCK);
      const result = await fn(db);
      await db.query("COMMIT");
      return result;
    } catch (err) {
      await db.query("ROLLBACK").catch(() => undefined);
      throw err;
    }
  });
}

export async function updateUser(
  deps: UsersDeps,
  caller: Caller,
  id: string,
  patch: UserPatch,
): Promise<UserView> {
  return withRoleLock(deps, async (db) => {
    const current = await getUserFrom(db, id);
    // Nobody edits their own privileges: an admin must not promote or demote
    // themselves through the users API, even when the root checks would pass.
    if (caller.kind === "session" && caller.userId === id && patch.role !== undefined) {
      throw new DomainError("conflict", "You cannot change your own role");
    }
    if (patch.role !== undefined) await assertRoleChangeAllowed(db, caller, current, patch.role);

    await db.query(
      `update public.profiles
          set display_name = coalesce($2, display_name),
              locale = coalesce($3, locale),
              timezone = coalesce($4, timezone),
              role = coalesce($5, role),
              updated_at = now()
        where id = $1`,
      [id, patch.display_name ?? null, patch.locale ?? null, patch.timezone ?? null, patch.role ?? null],
    );
    return getUserFrom(db, id);
  });
}

export async function deactivateUser(
  deps: UsersDeps,
  caller: Caller,
  id: string,
): Promise<UserView> {
  if (caller.kind !== "session" || caller.role !== "super_admin") {
    throw new DomainError("insufficient_scope");
  }
  return withRoleLock(deps, async (db) => {
    const current = await getUserFrom(db, id);
    // Before the root check: self-deactivation is forbidden for everyone,
    // including the root, so the API never answers "the root…" to its own
    // account (the diagnostic would be misleading and the action still wrong).
    if (caller.kind === "session" && caller.userId === id) {
      throw new DomainError("conflict", "You cannot deactivate your own account");
    }
    if ((await rootUserId(db)) === current.id) {
      throw new DomainError("conflict", "The root user cannot be deactivated");
    }
    if (current.role === "super_admin" && (await activeSuperAdmins(db)) <= 1) {
      throw new DomainError("conflict", "The instance needs at least one active super_admin");
    }
    await db.query(
      "update public.profiles set deactivated_at = coalesce(deactivated_at, now()), updated_at = now() where id = $1",
      [id],
    );
    // Deactivation revokes machine access immediately: live credential checks
    // reject revoked keys, and devices stop receiving pushes.
    await db.query(
      "update public.api_keys set revoked_at = coalesce(revoked_at, now()) where user_id = $1 and revoked_at is null",
      [id],
    );
    await db.query(
      "update public.devices set revoked_at = coalesce(revoked_at, now()) where user_id = $1 and revoked_at is null",
      [id],
    );
    const view = await getUserFrom(db, id);
    await enqueueEvent(db, {
      type: "user.deactivated",
      target: "admins",
      resource: view,
      payload: { reason: null },
    });
    return view;
  });
}
