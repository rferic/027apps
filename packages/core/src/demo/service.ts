/**
 * Demo data (D21): the Core owns the sample members, category and invitation,
 * and every module seeds its own rows through the `demo` hooks of its manifest.
 *
 * The capability is off unless `demo.enabled` is on, and it is refused on a
 * production build unless `ALLOW_DEMO_DATA=true` is set on the instance: a
 * staging deployment opts in explicitly, production never does.
 *
 * Nothing here sends email: the demo invitation is identifiable by its
 * `@example.test` address and is never passed to the email port.
 */

import { DomainError } from "../errors";
import type { QueryClient } from "../api/rate-limit-storage";
import type { JsonValue } from "../api/types";
import type { TransactionRunner } from "../settings/service";
import { sha256 } from "../modules/manifest";

/** Every demo account shares it; the panel shows it to the operator. */
export const DEMO_PASSWORD = "027apps-demo!";

export const DEMO_USERS = [
  { email: "demo.ana@example.test", displayName: "Ana Demo" },
  { email: "demo.luis@example.test", displayName: "Luis Demo" },
  { email: "demo.marta@example.test", displayName: "Marta Demo" },
] as const;

export const DEMO_CATEGORY = { name: "Demo family", slug: "demo-family" } as const;

/**
 * Fixed token so a second seed is a no-op and the acceptance link is known. It
 * redeems only while the demo dataset exists.
 */
export const DEMO_INVITATION = {
  email: "demo.invitado@example.test",
  name: "Invitado Demo",
  token: "demo-invite-token",
} as const;

export type DemoModuleResult = { module_key: string; result: JsonValue | null };

export type DemoStatus = {
  enabled: boolean;
  /** A production build without `ALLOW_DEMO_DATA=true`. */
  production: boolean;
  seeded: boolean;
  seeded_at: string | null;
  members: number;
  modules: DemoModuleResult[];
};

export type DemoDeps = {
  db: QueryClient;
  withTransaction: TransactionRunner;
  auth: {
    createUser(email: string, password: string): Promise<{ userId: string }>;
    deleteUser(userId: string): Promise<void>;
  };
  env?: { nodeEnv?: string; allowDemo?: string };
};

type DemoHooks = { seed_fn: string; clear_fn: string };

function isProduction(deps: DemoDeps): boolean {
  return (deps.env?.nodeEnv ?? process.env.NODE_ENV) === "production";
}

function demoAllowed(deps: DemoDeps): boolean {
  const allow = deps.env?.allowDemo ?? process.env.ALLOW_DEMO_DATA;
  return !isProduction(deps) || allow === "true";
}

/** Reads the gate from the settings table: a missing row is off. */
async function demoEnabled(deps: DemoDeps): Promise<boolean> {
  const { rows } = await deps.db.query(
    "select value from public.settings where category_key = 'instance' and key = 'demo.enabled'",
  );
  return rows[0]?.value === true;
}

function quote(identifier: string): string {
  return `"${identifier}"`;
}

function schemaFor(key: string): string {
  return `module_${key.replace(/-/g, "_")}`;
}

function hooksOf(row: Record<string, unknown>): DemoHooks | null {
  const value = row.demo;
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;
  if (typeof record.seed_fn !== "string" || typeof record.clear_fn !== "string") return null;
  return { seed_fn: record.seed_fn, clear_fn: record.clear_fn };
}

async function demoModules(
  deps: DemoDeps,
): Promise<Array<{ key: string; hooks: DemoHooks }>> {
  const { rows } = await deps.db.query(
    "select key, demo from public.module_registry where state = 'active' and demo is not null order by key",
  );
  return rows.flatMap((row) => {
    const hooks = hooksOf(row);
    return hooks ? [{ key: String(row.key), hooks }] : [];
  });
}

export async function demoStatus(deps: DemoDeps): Promise<DemoStatus> {
  const enabled = await demoEnabled(deps);
  const { rows } = await deps.db.query(
    "select seeded_at, seed_results from public.demo_dataset where id",
  );
  const row = rows[0];
  const { rows: members } = await deps.db.query(
    "select count(*)::int as total from public.profiles where id in (select id from auth.users where email like 'demo.%@example.test')",
  );
  return {
    enabled,
    production: !demoAllowed(deps),
    seeded: row !== undefined,
    seeded_at: row?.seeded_at ? new Date(String(row.seeded_at)).toISOString() : null,
    members: Number(members[0]?.total ?? 0),
    modules: Array.isArray(row?.seed_results)
      ? (row.seed_results as DemoModuleResult[])
      : [],
  };
}

function assertUsable(status: { enabled: boolean; production: boolean }): void {
  if (!status.enabled) {
    throw new DomainError("insufficient_scope", "Demo data is disabled", {
      code: "demo_disabled",
    });
  }
  if (status.production) {
    throw new DomainError(
      "insufficient_scope",
      "Demo data is refused in production unless ALLOW_DEMO_DATA=true",
      { code: "demo_in_production" },
    );
  }
}

/** Existing demo auth users by email, so a re-seed reuses their ids. */
async function existingUserIds(deps: DemoDeps): Promise<Map<string, string>> {
  const emails = DEMO_USERS.map((user) => user.email);
  const { rows } = await deps.db.query(
    "select id, email from auth.users where email = any($1::text[])",
    [emails],
  );
  return new Map(rows.map((row) => [String(row.email), String(row.id)]));
}

async function ensureAuthUsers(deps: DemoDeps): Promise<Map<string, string>> {
  const ids = await existingUserIds(deps);
  const created: string[] = [];
  try {
    for (const user of DEMO_USERS) {
      if (ids.has(user.email)) continue;
      const { userId } = await deps.auth.createUser(user.email, DEMO_PASSWORD);
      ids.set(user.email, userId);
      created.push(userId);
    }
  } catch (error) {
    for (const id of created) await deps.auth.deleteUser(id).catch(() => undefined);
    throw error;
  }
  return ids;
}

async function seedModules(
  db: QueryClient,
  modules: Array<{ key: string; hooks: DemoHooks }>,
  ids: Record<string, JsonValue>,
): Promise<DemoModuleResult[]> {
  const results: DemoModuleResult[] = [];
  for (const module of modules) {
    try {
      await db.query(`set local search_path to ${quote(schemaFor(module.key))}`);
      const { rows } = await db.query(`select ${quote(module.hooks.seed_fn)}($1::jsonb) as result`, [
        JSON.stringify(ids),
      ]);
      results.push({ module_key: module.key, result: (rows[0]?.result ?? null) as JsonValue });
    } finally {
      await db.query("reset search_path").catch(() => undefined);
    }
  }
  return results;
}

/**
 * Seeds the demo dataset. Idempotent: users are matched by email, the category
 * by slug and the invitation by its fixed token hash, and the run replaces the
 * recorded module counts instead of appending.
 */
export async function seedDemo(deps: DemoDeps): Promise<DemoStatus> {
  assertUsable(await demoStatus(deps));

  const userIds = await ensureAuthUsers(deps);
  const modules = await demoModules(deps);
  const ids: Record<string, JsonValue> = {
    category_id: null,
    invitation_id: null,
    users: DEMO_USERS.map((user) => ({
      email: user.email,
      id: userIds.get(user.email) ?? null,
    })),
  };

  try {
    await deps.withTransaction(async (db) => {
      for (const user of DEMO_USERS) {
        await db.query(
          `insert into public.profiles (id, display_name, role)
           values ($1, $2, 'user')
           on conflict (id) do update set display_name = excluded.display_name`,
          [userIds.get(user.email), user.displayName],
        );
      }

      const { rows: category } = await db.query(
        `insert into public.user_categories (name, slug)
         values ($1, $2)
         on conflict (slug) do update set name = excluded.name
         returning id`,
        [DEMO_CATEGORY.name, DEMO_CATEGORY.slug],
      );
      const categoryId = String(category[0].id);
      ids.category_id = categoryId;

      for (const user of DEMO_USERS) {
        await db.query(
          `insert into public.user_category_members (user_category_id, user_id)
           values ($1, $2)
           on conflict do nothing`,
          [categoryId, userIds.get(user.email)],
        );
      }

      const owner = userIds.get(DEMO_USERS[0].email) ?? null;
      const { rows: invitation } = await db.query(
        `insert into public.invitations
           (email, name, user_category_id, token_hash, expires_at, created_by)
         values ($1, $2, $3, $4, now() + interval '30 days', $5)
         on conflict (token_hash) do update set expires_at = excluded.expires_at
         returning id`,
        [
          DEMO_INVITATION.email,
          DEMO_INVITATION.name,
          categoryId,
          sha256(DEMO_INVITATION.token).slice("sha256:".length),
          owner,
        ],
      );
      ids.invitation_id = String(invitation[0].id);

      const results = await seedModules(db, modules, ids);
      await db.query(
        `insert into public.demo_dataset (id, seeded_at, seed_results)
         values (true, now(), $1::jsonb)
         on conflict (id) do update
           set seeded_at = excluded.seeded_at, seed_results = excluded.seed_results`,
        [JSON.stringify(results)],
      );
    });
  } catch (error) {
    for (const id of userIds.values()) await deps.auth.deleteUser(id).catch(() => undefined);
    throw error;
  }

  return demoStatus(deps);
}

/** Runs a module's `clear_fn`; a raise means its data is still linked. */
async function clearModules(
  db: QueryClient,
  modules: Array<{ key: string; hooks: DemoHooks }>,
): Promise<void> {
  for (const module of modules) {
    try {
      await db.query(`set local search_path to ${quote(schemaFor(module.key))}`);
      await db.query(`select ${quote(module.hooks.clear_fn)}()`);
    } catch {
      throw new DomainError("conflict", `Module ${module.key} still holds demo data`, {
        code: "demo_linked",
        module_key: module.key,
      });
    } finally {
      await db.query("reset search_path").catch(() => undefined);
    }
  }
}

/**
 * Removes the demo dataset. It refuses (and rolls back) while a module's
 * `clear_fn` raises; otherwise it deletes the Core rows and, after the
 * transaction, the auth users, so no orphan profile is left behind.
 */
export async function clearDemo(deps: DemoDeps): Promise<DemoStatus> {
  assertUsable(await demoStatus(deps));
  const modules = await demoModules(deps);
  const { rows } = await deps.db.query("select id from auth.users where email = any($1::text[])", [
    DEMO_USERS.map((user) => user.email),
  ]);
  const userIds = rows.map((row) => String(row.id));

  await deps.withTransaction(async (db) => {
    await clearModules(db, modules);
    await db.query("delete from public.invitations where token_hash = $1", [
      sha256(DEMO_INVITATION.token).slice("sha256:".length),
    ]);
    await db.query("delete from public.user_categories where slug = $1", [DEMO_CATEGORY.slug]);
    await db.query("delete from public.profiles where id = any($1::uuid[])", [
      userIds.length > 0 ? userIds : [],
    ]);
    await db.query("delete from public.demo_dataset where id");
  });

  for (const id of userIds) await deps.auth.deleteUser(id).catch(() => undefined);
  return demoStatus(deps);
}

/**
 * Before a module's schema is dropped: its `clear_fn` gets a last chance to
 * clean what it owns. Best effort by design — the schema drop removes its data
 * anyway, and a broken hook must not trap the module installed.
 */
export async function clearDemoForModule(db: QueryClient, key: string): Promise<void> {
  const { rows } = await db.query("select demo from public.module_registry where key = $1", [key]);
  const hooks = rows[0] ? hooksOf(rows[0]) : null;
  if (!hooks) return;
  try {
    await db.query(`set local search_path to ${quote(schemaFor(key))}`);
    await db.query(`select ${quote(hooks.clear_fn)}()`);
  } catch {
    // The uninstall continues: the schema (and its data) is about to be dropped.
  } finally {
    await db.query("reset search_path").catch(() => undefined);
  }
}
