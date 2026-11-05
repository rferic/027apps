import { DomainError } from "../errors";
import type { Caller } from "../api/types";
import type { QueryClient } from "../api/rate-limit-storage";

/**
 * Users and roles (core-api spec §3.2). Invariants enforced here, not in the
 * route: the root (the first super_admin created by /setup) cannot be demoted
 * or deactivated, the instance never loses its last active super_admin, and an
 * admin cannot touch a super_admin role.
 */
export type Role = "super_admin" | "admin" | "user";

export interface UsersDeps {
  db: QueryClient;
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
  total: number;
}

export interface UserPatch {
  display_name?: string;
  locale?: string;
  timezone?: string;
  role?: Role;
}

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

/** The root is the first super_admin created by /setup (oldest, stable). */
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

/** True only for a session super_admin; machine keys cannot change roles. */
function canManageSuperAdmins(caller: Caller): boolean {
  return caller.kind === "session" && caller.role === "super_admin";
}

export async function listUsers(deps: UsersDeps, filters: UserListFilters): Promise<UserList> {
  const pattern = filters.q ? `%${filters.q}%` : null;
  const { rows } = await deps.db.query(
    `select p.id, p.display_name, p.locale, p.timezone, p.role, p.created_at, p.deactivated_at
       from public.profiles p
       join auth.users u on u.id = p.id
      where ($1::text is null or p.display_name ilike $1 or u.email ilike $1)
      order by p.created_at asc, p.id asc
      limit $2 offset $3`,
    [pattern, filters.limit, filters.offset],
  );
  const { rows: countRows } = await deps.db.query(
    `select count(*)::int as n
       from public.profiles p
       join auth.users u on u.id = p.id
      where ($1::text is null or p.display_name ilike $1 or u.email ilike $1)`,
    [pattern],
  );
  return { users: rows.map(toView), total: Number(countRows[0]?.n ?? 0) };
}

export async function getUser(deps: UsersDeps, id: string): Promise<UserView> {
  const { rows } = await deps.db.query(
    "select id, display_name, locale, timezone, role, created_at, deactivated_at from public.profiles where id = $1",
    [id],
  );
  if (!rows[0]) throw new DomainError("not_found");
  return toView(rows[0]);
}

async function assertRoleChangeAllowed(
  deps: UsersDeps,
  caller: Caller,
  current: UserView,
  nextRole: Role,
): Promise<void> {
  if (nextRole === current.role) return;
  if (caller.kind !== "session") throw new DomainError("insufficient_scope");

  // Admins manage admins/users but never touch a super_admin role.
  if (caller.role === "admin") {
    if (current.role === "super_admin" || nextRole === "super_admin") {
      throw new DomainError("insufficient_scope");
    }
    return;
  }
  if (caller.role !== "super_admin") throw new DomainError("insufficient_scope");

  if ((await rootUserId(deps.db)) === current.id) {
    throw new DomainError("conflict", "The root user cannot be demoted");
  }
  if (current.role === "super_admin" && (await activeSuperAdmins(deps.db)) <= 1) {
    throw new DomainError("conflict", "The instance needs at least one active super_admin");
  }
}

export async function updateUser(
  deps: UsersDeps,
  caller: Caller,
  id: string,
  patch: UserPatch,
): Promise<UserView> {
  const current = await getUser(deps, id);
  if (patch.role !== undefined) await assertRoleChangeAllowed(deps, caller, current, patch.role);

  await deps.db.query(
    `update public.profiles
        set display_name = coalesce($2, display_name),
            locale = coalesce($3, locale),
            timezone = coalesce($4, timezone),
            role = coalesce($5, role),
            updated_at = now()
      where id = $1`,
    [id, patch.display_name ?? null, patch.locale ?? null, patch.timezone ?? null, patch.role ?? null],
  );
  return getUser(deps, id);
}

export async function deactivateUser(
  deps: UsersDeps,
  caller: Caller,
  id: string,
): Promise<UserView> {
  if (!canManageSuperAdmins(caller)) throw new DomainError("insufficient_scope");
  const current = await getUser(deps, id);
  if ((await rootUserId(deps.db)) === current.id) {
    throw new DomainError("conflict", "The root user cannot be deactivated");
  }
  if (current.role === "super_admin" && (await activeSuperAdmins(deps.db)) <= 1) {
    throw new DomainError("conflict", "The instance needs at least one active super_admin");
  }
  await deps.db.query(
    "update public.profiles set deactivated_at = coalesce(deactivated_at, now()), updated_at = now() where id = $1",
    [id],
  );
  return getUser(deps, id);
}
