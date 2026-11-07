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
export type UserState = "active" | "deactivated";
/** `all` is an explicit opt-out; omitting the filter defaults to active. */
export type UserStateFilter = UserState | "all";

export interface UsersDeps {
  db: QueryClient;
  /** Runs the invariants + write in one transaction (injected by the app). */
  withTransaction?: <T>(fn: (db: QueryClient) => Promise<T>) => Promise<T>;
}

export type UserCategory = { id: string; name: string };

export type UserView = {
  id: string;
  display_name: string;
  locale: string;
  timezone: string;
  role: Role;
  created_at: string;
  deactivated_at: string | null;
  /** Categories the profile belongs to, ordered by name. */
  categories: UserCategory[];
};

export interface UserListFilters {
  q?: string;
  role?: Role;
  /**
   * `active` (the default when omitted), `deactivated`, or `all` for no
   * state filter. A list never shows deactivated profiles by accident.
   */
  state?: UserStateFilter;
  /** Only profiles that belong to this category (already validated as a uuid). */
  category?: string;
  limit: number;
  offset: number;
}

export interface UserList {
  users: UserView[];
  /** Profiles matching every filter (including `state`), across every page. */
  total: number;
  /**
   * Active (not deactivated) profiles matching `q` + `role`, across every
   * page. It deliberately ignores `state`: the dashboard keeps "how many are
   * active among the current search" even when the list shows deactivated
   * profiles.
   */
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

/**
 * `json_agg` arrives already parsed from the driver, but a text representation
 * is tolerated as well. Anything malformed is dropped instead of failing the
 * whole read; the order is guaranteed here so every caller sees the same list.
 */
function toCategories(value: unknown): UserCategory[] {
  let entries: unknown = value;
  if (typeof entries === "string") {
    try {
      entries = JSON.parse(entries);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(entries)) return [];
  const categories: UserCategory[] = [];
  for (const entry of entries) {
    if (typeof entry !== "object" || entry === null) continue;
    const row = entry as Record<string, unknown>;
    if (typeof row.id !== "string" || typeof row.name !== "string") continue;
    categories.push({ id: row.id, name: row.name });
  }
  return categories.sort((a, b) => a.name.localeCompare(b.name));
}

function toView(row: Record<string, unknown>): UserView {
  return {
    id: String(row.id),
    display_name: String(row.display_name),
    locale: String(row.locale),
    timezone: String(row.timezone),
    role: row.role as Role,
    created_at: toIso(row.created_at) ?? new Date(0).toISOString(),
    deactivated_at: toIso(row.deactivated_at),
    categories: toCategories(row.categories),
  };
}

/** Escape `%`, `_` and `\` so `q` is a literal ILIKE pattern. */
function likePattern(q: string): string {
  return `%${q.replace(/[\\%_]/g, "\\$&")}%`;
}

/** One profile plus its categories, aggregated in the same query (no N+1). */
async function getUserFrom(db: QueryClient, id: string): Promise<UserView> {
  const { rows } = await db.query(
    `select p.id, p.display_name, p.locale, p.timezone, p.role, p.created_at, p.deactivated_at,
            coalesce(
              json_agg(json_build_object('id', c.id, 'name', c.name) order by c.name asc)
                filter (where c.id is not null),
              '[]'::json
            ) as categories
       from public.profiles p
       left join public.user_category_members m on m.user_id = p.id
       left join public.user_categories c on c.id = m.user_category_id
      where p.id = $1
      group by p.id`,
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

/**
 * The root regardless of its state: purge accepts deactivated profiles, so the
 * active-only definition would let a deactivated root be deleted.
 */
async function rootUserIdAnyState(db: QueryClient): Promise<string | null> {
  const { rows } = await db.query(
    "select id from public.profiles where role = 'super_admin' order by created_at asc, id asc limit 1",
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
  // `null` means "no state filter"; a boolean lets both queries share the SQL.
  // Omitting the filter is the safe default: active profiles only.
  const state = filters.state ?? "active";
  const active = state === "all" ? null : state === "active";
  const category = filters.category ?? null;
  // Categories reach the page in the same query: one row per profile, never a
  // read per user. The `exists` subquery keeps the membership filter separate
  // from the join that feeds the aggregate.
  const { rows } = await deps.db.query(
    `select p.id, p.display_name, p.locale, p.timezone, p.role, p.created_at, p.deactivated_at,
            coalesce(
              json_agg(json_build_object('id', c.id, 'name', c.name) order by c.name asc)
                filter (where c.id is not null),
              '[]'::json
            ) as categories
       from public.profiles p
       join auth.users u on u.id = p.id
       left join public.user_category_members m on m.user_id = p.id
       left join public.user_categories c on c.id = m.user_category_id
      where ($1::text is null or p.display_name ilike $1 escape '\\' or u.email ilike $1 escape '\\')
        and ($2::text is null or p.role = $2)
        and ($3::boolean is null or (p.deactivated_at is null) = $3)
        and ($4::uuid is null or exists (
              select 1 from public.user_category_members cm
               where cm.user_id = p.id and cm.user_category_id = $4))
      group by p.id
      order by p.created_at asc, p.id asc
      limit $5 offset $6`,
    [pattern, filters.role ?? null, active, category, filters.limit, filters.offset],
  );
  const { rows: countRows } = await deps.db.query(
    `select count(*) filter (where ($3::boolean is null or (p.deactivated_at is null) = $3))::int as n,
            count(*) filter (where p.deactivated_at is null)::int as active_total
       from public.profiles p
       join auth.users u on u.id = p.id
      where ($1::text is null or p.display_name ilike $1 escape '\\' or u.email ilike $1 escape '\\')
        and ($2::text is null or p.role = $2)
        and ($4::uuid is null or exists (
              select 1 from public.user_category_members cm
               where cm.user_id = p.id and cm.user_category_id = $4))`,
    [pattern, filters.role ?? null, active, category],
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

/**
 * POST /api/v1/users/{id}/restore — undo a soft deactivation (super_admin).
 *
 * Reactivation cannot break an invariant (the root is always safe and no
 * "last super_admin" rule can be violated by adding access back), so there is
 * no advisory lock and no conflict path beyond 404. An already active profile
 * is a 200 without a write: retrying the request is safe.
 *
 * Revoked credentials stay revoked on purpose: restoring access never
 * resurrects api keys or devices that were revoked at deactivation.
 */
export async function restoreUser(
  deps: UsersDeps,
  caller: Caller,
  id: string,
): Promise<UserView> {
  if (caller.kind !== "session" || caller.role !== "super_admin") {
    throw new DomainError("insufficient_scope");
  }
  const current = await getUserFrom(deps.db, id);
  if (current.deactivated_at === null) return current;
  await deps.db.query(
    "update public.profiles set deactivated_at = null, updated_at = now() where id = $1",
    [id],
  );
  return getUserFrom(deps.db, id);
}

/**
 * DELETE /api/v1/users/{id}/purge — physical deletion (super_admin, irreversible).
 *
 * Only a deactivated profile can be purged: the explicit prior deactivation is
 * what keeps this apart from a single accidental click. The root and the last
 * active super_admin can never be purged, and nobody purges their own account.
 *
 * One transaction with the same role advisory lock as deactivation: the
 * references that would block `delete from auth.users` are nulled first, so the
 * profile, its devices and its own keys fall by cascade. The attribution of
 * history (settings, translations, invitations, categories and module grants)
 * survives without an actor; that is the audit trail this operation discards.
 */
export async function purgeUser(
  deps: UsersDeps,
  caller: Caller,
  id: string,
): Promise<void> {
  if (caller.kind !== "session" || caller.role !== "super_admin") {
    throw new DomainError("insufficient_scope");
  }
  await withRoleLock(deps, async (db) => {
    const current = await getUserFrom(db, id);
    // Self first: the diagnostic never says "the root…" to the root itself.
    if (caller.kind === "session" && caller.userId === id) {
      throw new DomainError("conflict", "You cannot delete your own account");
    }
    if ((await rootUserIdAnyState(db)) === current.id) {
      throw new DomainError("conflict", "The root user cannot be deleted");
    }
    if (current.role === "super_admin" && (await activeSuperAdmins(db)) <= 1) {
      throw new DomainError("conflict", "The instance needs at least one active super_admin");
    }
    if (current.deactivated_at === null) {
      throw new DomainError("conflict", "Deactivate the member before deleting it");
    }

    // Null every actor reference that has no ON DELETE action. A single
    // transaction keeps the database from being left half-purged on failure.
    await db.query(
      "update public.settings set updated_by = null, updated_by_key = null where updated_by = $1",
      [id],
    );
    await db.query("update public.api_keys set created_by = null where created_by = $1", [id]);
    await db.query("update public.invitations set created_by = null where created_by = $1", [id]);
    await db.query("update public.translations set updated_by = null where updated_by = $1", [id]);
    await db.query("update public.user_categories set created_by = null where created_by = $1", [id]);
    await db.query("update public.user_modules set granted_by = null where granted_by = $1", [id]);
    await db.query(
      "update public.user_category_modules set assigned_by = null where assigned_by = $1",
      [id],
    );

    // The profile's own delegated keys also fall by cascade; any history that
    // points at those keys (a delegated admin key acted as the author) would
    // otherwise block the delete after the profile is gone.
    const ownKeys = "select id from public.api_keys where user_id = $1";
    await db.query(
      `update public.settings set updated_by_key = null where updated_by_key in (${ownKeys})`,
      [id],
    );
    await db.query(
      `update public.user_categories set created_by_key = null where created_by_key in (${ownKeys})`,
      [id],
    );
    await db.query(
      `update public.invitations set created_by_key = null where created_by_key in (${ownKeys})`,
      [id],
    );
    await db.query(
      `update public.user_modules set granted_by_key = null where granted_by_key in (${ownKeys})`,
      [id],
    );
    await db.query(
      `update public.user_category_modules set assigned_by_key = null where assigned_by_key in (${ownKeys})`,
      [id],
    );

    // `profiles`, `devices` and the user's own (delegated) keys cascade.
    await db.query("delete from auth.users where id = $1", [id]);
  });
}
