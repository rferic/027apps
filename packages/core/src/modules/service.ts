import { resolve, sep } from "node:path";
import { DomainError } from "../errors";
import { CORE_CONTRACT } from "../version";
import { clearDemoForModule } from "../demo/service";
import { enqueueEvent } from "../realtime/service";
import type { Caller, JsonValue } from "../api/types";
import type { QueryClient } from "../api/rate-limit-storage";
import {
  assertSafeModuleSql,
  manifestDigest,
  sha256,
  validateManifest,
  type ModuleManifest,
} from "./manifest";

/**
 * Module installer and lifecycle (module-system spec §4/§5). Install applies
 * the manifest DDL inside one transaction as `module_installer` (a restricted
 * non-superuser role) in `module_<key>`, verifies every digest and seeds the
 * module's settings. Uninstall reverses `down` in reverse order and cleans the
 * Core-owned rows; the module's own `down` decides what happens to its data.
 */
export interface ModulesDeps {
  db: QueryClient;
  withTransaction?: <T>(fn: (db: QueryClient) => Promise<T>) => Promise<T>;
  readFile?: (path: string) => Promise<string>;
  moduleRoot?: (key: string) => string;
  encryption?: { encrypt(plaintext: string, slot: string): Promise<string | null> };
}

export type ModuleState = "installed" | "active" | "disabled";

/** Filters applied in SQL, so `total` counts the filtered set and not one page. */
export type ModuleStateFilter = "all" | ModuleState;
export type ModulePublicFilter = "all" | "yes" | "no";

export interface ModuleListFilters {
  /** Omitted or `all` keeps every lifecycle state. */
  state?: ModuleStateFilter;
  /** Omitted or `all` keeps public and private modules alike. */
  public?: ModulePublicFilter;
}

/** One page of modules plus the total across every page. */
export interface ModuleList {
  modules: ModuleView[];
  total: number;
}

export interface ModulePage {
  limit: number;
  offset: number;
}

export type ModuleAppAction = { key: string; label: string; icon: string; screen: string };

export type ModuleDemo = { seed_fn: string; clear_fn: string };

export type ModuleView = {
  key: string;
  name: string;
  version: string;
  state: ModuleState;
  is_public: boolean;
  mcp_exposed: "none" | "read" | "read_write";
  manifest_digest: string;
  installed_at: string;
  updated_at: string;
  app_actions: ModuleAppAction[];
  demo: ModuleDemo | null;
};

/** Access holder of a module: a user grant or a category assignment. */
export type ModuleGrantUser = { id: string; display_name: string };
export type ModuleGrantCategory = { id: string; name: string };

export type ModuleGrants = {
  users: ModuleGrantUser[];
  categories: ModuleGrantCategory[];
};

export type ModuleSettingView = {
  category_key: string;
  key: string;
  label: string;
  help: string | null;
  value: JsonValue | null;
  is_secret: boolean;
  configured: boolean;
  is_public: boolean;
  mcp_access: "none" | "read" | "write";
  sort_order: number;
  updated_at: string;
};

export type ModuleDetail = ModuleView & { settings_public: ModuleSettingView[] };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MODULE_KEY = /^[a-z0-9][a-z0-9_-]{0,63}$/;
const MODULE_ROLE = "module_installer";

const toIso = (value: unknown): string =>
  value instanceof Date ? value.toISOString() : String(value ?? "");

async function withTx<T>(deps: ModulesDeps, fn: (db: QueryClient) => Promise<T>): Promise<T> {
  // Module DDL must run inside a real transaction (SET LOCAL ROLE is ignored
  // outside one). The runner owns BEGIN/COMMIT; tests run inside their own.
  if (!deps.withTransaction) {
    throw new DomainError("internal", "module operations require a transaction runner");
  }
  return deps.withTransaction(fn);
}

function isAdmin(caller: Caller): boolean {
  if (caller.kind === "session") return caller.role === "admin" || caller.role === "super_admin";
  if (caller.kind === "service") return true;
  // A delegated key is always a plain user, whatever its stored role cap.
  return false;
}

function isSuperAdmin(caller: Caller): boolean {
  if (caller.kind === "session") return caller.role === "super_admin";
  if (caller.kind === "service") return caller.roleCap === "super_admin";
  // A delegated key is always a plain user, whatever its stored role cap.
  return false;
}

function actorFor(caller: Caller): { by: string | null; byKey: string | null } {
  if (caller.kind === "session") return { by: caller.userId, byKey: null };
  if (caller.kind === "service" || caller.kind === "delegated") {
    return { by: null, byKey: caller.keyId };
  }
  throw new DomainError("insufficient_scope");
}

function schemaFor(key: string): string {
  return `module_${key.replace(/-/g, "_")}`;
}

function categoryFor(key: string): string {
  return key.replace(/-/g, "_");
}

function quoteIdent(value: string): string {
  if (!/^[a-z_][a-z0-9_]*$/.test(value)) throw new DomainError("internal", "invalid SQL identifier");
  return `"${value}"`;
}

function isDemoHooks(value: unknown): value is ModuleDemo {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return typeof record.seed_fn === "string" && typeof record.clear_fn === "string";
}

function toModuleView(row: Record<string, unknown>): ModuleView {
  return {
    key: String(row.key),
    name: String(row.name),
    version: String(row.version),
    state: String(row.state) as ModuleState,
    is_public: row.is_public === true,
    mcp_exposed: String(row.mcp_exposed) as ModuleView["mcp_exposed"],
    manifest_digest: String(row.manifest_digest ?? ""),
    installed_at: toIso(row.installed_at),
    updated_at: toIso(row.updated_at),
    app_actions: Array.isArray(row.app_actions) ? (row.app_actions as ModuleView["app_actions"]) : [],
    demo: isDemoHooks(row.demo) ? row.demo : null,
  };
}

function toSettingView(row: Record<string, unknown>): ModuleSettingView {
  const isSecret = row.is_secret === true;
  return {
    category_key: String(row.category_key),
    key: String(row.key),
    label: String(row.label),
    help: row.help === null ? null : String(row.help),
    value: isSecret ? null : ((row.value ?? null) as JsonValue),
    is_secret: isSecret,
    configured: isSecret ? row.value_encrypted !== null && row.value_encrypted !== undefined : true,
    is_public: row.is_public === true,
    mcp_access: String(row.mcp_access) as ModuleSettingView["mcp_access"],
    sort_order: Number(row.sort_order),
    updated_at: toIso(row.updated_at),
  };
}

const MODULE_COLUMNS =
  "key, name, version, state, is_public, mcp_exposed, manifest_digest, installed_at, updated_at, app_actions, demo";

async function getModuleRow(db: QueryClient, key: string): Promise<Record<string, unknown>> {
  const { rows } = await db.query(`select ${MODULE_COLUMNS} from public.module_registry where key = $1`, [
    key,
  ]);
  if (!rows[0]) throw new DomainError("not_found");
  return rows[0];
}

function safePackagePath(root: string, relative: string): string {
  const base = resolve(root);
  const full = resolve(base, relative);
  if (full !== base && !full.startsWith(base + sep)) {
    throw new DomainError("validation_failed", "module file escapes its package");
  }
  return full;
}

async function resolveSql(deps: ModulesDeps, key: string, value: string): Promise<string> {
  if (!/^(\.\/|\/)/.test(value)) return value;
  if (!deps.readFile || !deps.moduleRoot) {
    throw new DomainError("internal", "module files are not available at runtime");
  }
  const root = deps.moduleRoot(key);
  const relative = value.replace(/^\.\//, "");
  return deps.readFile(safePackagePath(root, relative));
}

async function readDoc(
  deps: ModulesDeps,
  key: string,
  path: string | undefined,
  label: string,
): Promise<string> {
  if (!path) return "";
  if (!deps.readFile || !deps.moduleRoot) {
    throw new DomainError("internal", "module files are not available at runtime");
  }
  const content = await deps.readFile(safePackagePath(deps.moduleRoot(key), path));
  if (content.trim() === "") throw new DomainError("validation_failed", `empty ${label} document`);
  return content;
}

/** Verifies the manifest's files and digests before touching the database. */
async function verifyModuleFiles(
  deps: ModulesDeps,
  manifest: ModuleManifest,
): Promise<{ up: Map<string, string>; down: Map<string, string> }> {
  const up = new Map<string, string>();
  const down = new Map<string, string>();
  for (const migration of manifest.migrations) {
    const upSql = await resolveSql(deps, manifest.key, migration.up);
    const downSql = await resolveSql(deps, manifest.key, migration.down);
    assertSafeModuleSql(upSql, manifest.key);
    assertSafeModuleSql(downSql, manifest.key);
    if (sha256(upSql) !== migration.digest) {
      throw new DomainError("validation_failed", "migration up digest mismatch");
    }
    if (sha256(downSql) !== migration.down_digest) {
      throw new DomainError("validation_failed", "migration down digest mismatch");
    }
    up.set(migration.version, upSql);
    down.set(migration.version, downSql);
  }

  const readme = await readDoc(deps, manifest.key, manifest.docs.readme, "readme");
  if (!readme) throw new DomainError("validation_failed", "a module needs a README");
  const api = await readDoc(deps, manifest.key, manifest.docs.api, "api");
  for (const scope of manifest.scopes) {
    if (api && !api.includes(scope)) {
      throw new DomainError("validation_failed", `scope ${scope} is missing from the api docs`);
    }
  }
  const mcp = await readDoc(deps, manifest.key, manifest.docs.mcp, "mcp");
  for (const tool of manifest.mcp_tools) {
    if (mcp && !mcp.includes(tool.name)) {
      throw new DomainError("validation_failed", `tool ${tool.name} is missing from the mcp docs`);
    }
  }
  const settingsDoc = await readDoc(deps, manifest.key, manifest.docs.settings, "settings");
  for (const category of manifest.settings) {
    for (const setting of category.settings) {
      if (settingsDoc && !settingsDoc.includes(setting.key)) {
        throw new DomainError(
          "validation_failed",
          `setting ${setting.key} is missing from the settings docs`,
        );
      }
    }
  }
  const eventsDoc = await readDoc(deps, manifest.key, manifest.docs.events, "events");
  for (const event of manifest.events) {
    if (eventsDoc && !eventsDoc.includes(event.type)) {
      throw new DomainError("validation_failed", `event ${event.type} is missing from the events docs`);
    }
  }
  for (const channel of manifest.channels) {
    if (eventsDoc && !eventsDoc.includes(channel.pattern)) {
      throw new DomainError(
        "validation_failed",
        `channel ${channel.pattern} is missing from the events docs`,
      );
    }
  }
  if (deps.readFile && deps.moduleRoot) {
    for (const page of manifest.admin_pages) {
      const content = await deps.readFile(`${deps.moduleRoot(manifest.key)}/admin/${page.route}/page.tsx`);
      if (content.trim() === "") throw new DomainError("validation_failed", "empty admin page");
    }
    const icon = await deps.readFile(`${deps.moduleRoot(manifest.key)}/${manifest.branding.icon}`);
    if (!/<svg[\s>]/i.test(icon) || !icon.includes("currentColor")) {
      throw new DomainError("validation_failed", "branding icon must be a monochrome SVG");
    }
  }

  return { up, down };
}

async function applySql(
  db: QueryClient,
  key: string,
  sql: string,
): Promise<void> {
  await db.query(`set local role ${MODULE_ROLE}`);
  try {
    await db.query(`set local search_path to ${quoteIdent(schemaFor(key))}`);
    await db.query(sql);
  } finally {
    await db.query("reset role");
    // `set local` lasts until the transaction ends, and the installer shares
    // that transaction with later work: leaving the module schema as the
    // search_path would hide `extensions` and break unrelated queries.
    await db.query("reset search_path");
  }
}

/**
 * After a module's migrations the schema exists but nobody can use it: the DDL
 * runs as `module_installer`. Grant the minimum the API needs — `authenticated`
 * still goes through RLS — and keep future migrations covered with default
 * privileges, so a new table is usable without a manual grant.
 */
async function grantModulePrivileges(db: QueryClient, schema: string): Promise<void> {
  const s = quoteIdent(schema);
  await db.query(`grant usage on schema ${s} to authenticated, service_role`);
  await db.query(
    `grant select, insert, update, delete on all tables in schema ${s} to authenticated`,
  );
  await db.query(`grant all on all tables in schema ${s} to service_role`);
  await db.query(
    `grant usage, select on all sequences in schema ${s} to authenticated, service_role`,
  );
  await db.query(
    `alter default privileges for role ${MODULE_ROLE} in schema ${s}
       grant select, insert, update, delete on tables to authenticated`,
  );
  await db.query(
    `alter default privileges for role ${MODULE_ROLE} in schema ${s}
       grant all on tables to service_role`,
  );
  await db.query(
    `alter default privileges for role ${MODULE_ROLE} in schema ${s}
       grant usage, select on sequences to authenticated, service_role`,
  );
}

/**
 * A module may reference `profiles(id)` only with `on delete set null`:
 * `purgeUser` deletes `auth.users` and cannot clean module schemas, so any
 * other action would make deleting a user fail. Checked in the catalog, not by
 * parsing SQL.
 */
async function assertProfileForeignKeys(db: QueryClient, schema: string): Promise<void> {
  const { rows } = await db.query(
    `select c.conname
       from pg_constraint c
       join pg_class t on t.oid = c.conrelid
       join pg_namespace n on n.oid = t.relnamespace
      where c.contype = 'f'
        and n.nspname = $1
        and c.confrelid = 'public.profiles'::regclass
        and c.confdeltype <> 'n'`,
    [schema],
  );
  if (rows[0]) {
    throw new DomainError(
      "validation_failed",
      `module foreign key ${String(rows[0].conname)} to profiles must use on delete set null`,
      { code: "fk_profiles_missing_set_null" },
    );
  }
}

/** `1.2.3` compared by number, no range syntax: a requirement is a minimum. */
export function compareVersions(left: string, right: string): number {
  const a = left.split(".").map((part) => Number(part));
  const b = right.split(".").map((part) => Number(part));
  for (let index = 0; index < 3; index += 1) {
    const diff = (a[index] ?? 0) - (b[index] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

type Requirement = { key: string; version: string };

/**
 * Install needs the dependency present; activate needs it active. The version
 * is a minimum, so a newer dependency always satisfies it.
 */
async function assertRequirements(
  db: QueryClient,
  requires: readonly Requirement[],
  mode: "installed" | "active",
): Promise<void> {
  for (const requirement of requires) {
    const { rows } = await db.query(
      "select state, version from public.module_registry where key = $1",
      [requirement.key],
    );
    const row = rows[0];
    if (!row) {
      throw new DomainError(
        "validation_failed",
        `requires module ${requirement.key}`,
        { code: "missing_dependency", key: requirement.key },
      );
    }
    if (mode === "active" && row.state !== "active") {
      throw new DomainError(
        "conflict",
        `requires ${requirement.key} to be active`,
        { code: "dependency_inactive", key: requirement.key },
      );
    }
    if (compareVersions(String(row.version), requirement.version) < 0) {
      throw new DomainError(
        "validation_failed",
        `requires ${requirement.key} >= ${requirement.version}`,
        { code: "dependency_version", key: requirement.key },
      );
    }
  }
}

/** Refuses when another module that requires this one is `active` (or any state). */
async function assertNotRequired(
  db: QueryClient,
  key: string,
  states: readonly string[],
): Promise<void> {
  const { rows } = await db.query(
    `select r.key from public.module_registry r
      where r.key <> $1
        and r.state = any($2::text[])
        and exists (
          select 1 from jsonb_array_elements(r.requires) item
           where item->>'key' = $1
        )
      limit 1`,
    [key, states],
  );
  if (rows[0]) {
    throw new DomainError(
      "conflict",
      `module ${String(rows[0].key)} requires this one`,
      { code: "required_by_module", key: String(rows[0].key) },
    );
  }
}

export async function installModule(
  deps: ModulesDeps,
  caller: Caller,
  value: unknown,
): Promise<ModuleView> {
  if (!isAdmin(caller)) throw new DomainError("insufficient_scope");
  const manifest = validateManifest(value);
  if (manifest.contract !== CORE_CONTRACT) {
    throw new DomainError(
      "validation_failed",
      `module contract ${manifest.contract} does not match this Core (${CORE_CONTRACT})`,
      { code: "contract_mismatch", expected: CORE_CONTRACT },
    );
  }
  const files = await verifyModuleFiles(deps, manifest);
  const actor = actorFor(caller);
  const digest = manifestDigest(manifest);
  const schema = schemaFor(manifest.key);

  await withTx(deps, async (db) => {
    const { rows: existing } = await db.query(
      "select state from public.module_registry where key = $1",
      [manifest.key],
    );
    if (existing[0]) throw new DomainError("conflict", "Module is already installed");
    await assertRequirements(db, manifest.requires, "installed");

    await db.query(`create schema if not exists ${quoteIdent(schema)}`);
    await db.query(`grant usage, create on schema ${quoteIdent(schema)} to ${MODULE_ROLE}`);

    await db.query(
      `insert into public.module_registry
         (key, name, version, state, is_public, mcp_exposed, manifest_digest, scopes,
          app_visible, requires, jobs, app_actions, dashboard_widgets, demo)
       values ($1, $2, $3, 'installed', $4, 'read', $5, $6::text[], $7, $8::jsonb, $9::jsonb, $10::jsonb, $11::jsonb, $12::jsonb)`,
      [
        manifest.key,
        manifest.name,
        manifest.version,
        manifest.is_public,
        digest,
        manifest.scopes,
        manifest.app.visible,
        JSON.stringify(manifest.requires),
        JSON.stringify(manifest.jobs),
        JSON.stringify(manifest.app_actions),
        JSON.stringify(manifest.dashboard_widgets),
        JSON.stringify(manifest.demo ?? null),
      ],
    );
    for (const channel of manifest.channels) {
      await db.query(
        "insert into public.module_channels (module_key, pattern, members_fn) values ($1, $2, $3)",
        [manifest.key, channel.pattern, channel.members_fn],
      );
    }
    await enqueueEvent(db, {
      type: "module.installed",
      target: "admins",
      module_key: manifest.key,
      resource: { key: manifest.key, name: manifest.name, version: manifest.version, state: "installed" },
      payload: { version: manifest.version },
    });

    for (const migration of manifest.migrations) {
      const sql = files.up.get(migration.version)!;
      await applySql(db, manifest.key, sql);
      await db.query(
        `insert into public.module_migrations (module_key, version, direction, ddl_digest)
         values ($1, $2, 'up', $3)`,
        [manifest.key, migration.version, migration.digest],
      );
    }

    await grantModulePrivileges(db, schema);
    await assertProfileForeignKeys(db, schema);

    for (const group of manifest.settings) {
      await db.query(
        `insert into public.settings_categories
           (category_key, label, help, icon, sort_order, source)
         values ($1, $2, $3, $4, $5, $6)`,
        [group.category, group.label, null, group.icon ?? null, group.sort_order, `module:${manifest.key}`],
      );
      for (const setting of group.settings) {
        const fullKey = `${group.category}.${setting.key}`;
        await db.query(
          `insert into public.settings
             (category_key, key, label, help, value, is_secret, is_public, mcp_access,
              sort_order, updated_by, updated_by_key)
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [
            group.category,
            fullKey,
            setting.label,
            setting.help ?? null,
            setting.is_secret ? null : JSON.stringify(setting.default ?? null),
            setting.is_secret,
            setting.is_public,
            setting.mcp_access,
            setting.sort_order,
            actor.by,
            actor.byKey,
          ],
        );
      }
    }

  });

  return toModuleView(await getModuleRow(deps.db, manifest.key));
}

export async function listModules(
  deps: ModulesDeps,
  caller: Caller,
  page: ModulePage,
  filters: ModuleListFilters = {},
): Promise<ModuleList> {
  // `null` means "no filter"; the filter lives in the same CTE that feeds the
  // count, so `total` is the filtered total and never lies about the page.
  const state = filters.state && filters.state !== "all" ? filters.state : null;
  const isPublic =
    filters.public === "yes" ? true : filters.public === "no" ? false : null;
  if (isAdmin(caller)) {
    const { rows } = await deps.db.query(
      `with filtered as (
         select ${MODULE_COLUMNS} from public.module_registry
          where ($3::text is null or state = $3)
            and ($4::boolean is null or is_public = $4)
       ),
       total as (select count(*)::int as n from filtered),
       page as (
         select * from filtered
          order by installed_at desc, key desc
          limit $1 offset $2
       )
       select total.n as total, page.* from total left join page on true`,
      [page.limit, page.offset, state, isPublic],
    );
    const modules = rows.filter((row) => row.key !== null && row.key !== undefined);
    return { modules: modules.map(toModuleView), total: Number(rows[0]?.total ?? 0) };
  }
  const userId =
    caller.kind === "session" || caller.kind === "delegated" ? caller.userId : null;
  if (!userId) return { modules: [], total: 0 };
  const { rows } = await deps.db.query(
    `with filtered as (
       select ${MODULE_COLUMNS} from public.module_registry m
        where m.state = 'active'
          and (m.is_public = true or exists (
            select 1 from public.user_modules u
             where u.user_id = $1 and u.module_key = m.key and u.revoked_at is null
          ))
          and ($4::text is null or m.state = $4)
          and ($5::boolean is null or m.is_public = $5)
     ),
     total as (select count(*)::int as n from filtered),
     page as (
       select * from filtered
        order by installed_at desc, key desc
        limit $2 offset $3
     )
     select total.n as total, page.* from total left join page on true`,
    [userId, page.limit, page.offset, state, isPublic],
  );
  const modules = rows.filter((row) => row.key !== null && row.key !== undefined);
  return { modules: modules.map(toModuleView), total: Number(rows[0]?.total ?? 0) };
}

async function hasAccess(
  deps: ModulesDeps,
  caller: Caller,
  row: Record<string, unknown>,
): Promise<boolean> {
  if (isAdmin(caller)) return true;
  if (row.state !== "active") return false;
  if (row.is_public === true) return true;
  if (caller.kind !== "delegated" && caller.kind !== "session") return false;
  const { rows } = await deps.db.query(
    `select 1 from public.user_modules
      where user_id = $1 and module_key = $2 and revoked_at is null`,
    [caller.userId, row.key],
  );
  return rows.length > 0;
}

export async function getModule(
  deps: ModulesDeps,
  caller: Caller,
  key: string,
): Promise<ModuleDetail> {
  const row = await getModuleRow(deps.db, key);
  if (!(await hasAccess(deps, caller, row))) throw new DomainError("not_found");
  const { rows } = await deps.db.query(
    `select category_key, key, label, help, value, value_encrypted, is_secret, is_public,
            mcp_access, sort_order, updated_at
       from public.settings
      where category_key = $1 and is_public = true and is_secret = false
      order by sort_order asc, key asc`,
    [categoryFor(key)],
  );
  return { ...toModuleView(row), settings_public: rows.map(toSettingView) };
}

/**
 * Applies a newer package over an installed module: only the migrations that
 * are not applied yet run, in manifest order; settings are added, updated in
 * their labels and removed, never resetting the stored values. Anything that
 * is not a strictly newer version is refused, and a failed migration rolls the
 * whole upgrade back.
 */
export async function upgradeModule(
  deps: ModulesDeps,
  caller: Caller,
  key: string,
  manifestValue: unknown,
): Promise<ModuleView> {
  if (!isAdmin(caller)) throw new DomainError("insufficient_scope");
  const manifest = validateManifest(manifestValue);
  if (manifest.key !== key) throw new DomainError("validation_failed", "manifest does not match the key");
  if (manifest.contract !== CORE_CONTRACT) {
    throw new DomainError(
      "validation_failed",
      `module contract ${manifest.contract} does not match this Core (${CORE_CONTRACT})`,
      { code: "contract_mismatch", expected: CORE_CONTRACT },
    );
  }
  const files = await verifyModuleFiles(deps, manifest);
  const digest = manifestDigest(manifest);
  const category = categoryFor(manifest.key);

  return withTx(deps, async (db) => {
    const current = await getModuleRow(db, manifest.key);
    const installedVersion = String(current.version);
    if (compareVersions(manifest.version, installedVersion) <= 0) {
      throw new DomainError(
        "conflict",
        `module ${manifest.key} is at ${installedVersion}; ${manifest.version} is not newer`,
        { code: "not_newer", installed: installedVersion },
      );
    }
    await assertRequirements(
      db,
      manifest.requires,
      current.state === "active" ? "active" : "installed",
    );

    const { rows } = await db.query(
      `select version from public.module_migrations
        where module_key = $1 and direction = 'up'`,
      [manifest.key],
    );
    const applied = new Set(rows.map((row) => String(row.version)));
    const declared = new Set(manifest.migrations.map((migration) => migration.version));
    for (const version of applied) {
      if (!declared.has(version)) {
        throw new DomainError("conflict", `applied migration ${version} is missing from the manifest`);
      }
    }

    for (const migration of manifest.migrations) {
      if (applied.has(migration.version)) continue;
      const sql = files.up.get(migration.version);
      if (!sql) throw new DomainError("internal", `missing SQL for ${migration.version}`);
      await applySql(db, manifest.key, sql);
      await db.query(
        `insert into public.module_migrations (module_key, version, direction, ddl_digest)
         values ($1, $2, 'up', $3)`,
        [manifest.key, migration.version, migration.digest],
      );
    }

    const { rows: updated } = await db.query(
      `update public.module_registry
          set version = $2, manifest_digest = $3, scopes = $4, app_visible = $5,
              requires = $6::jsonb, jobs = $7::jsonb, app_actions = $8::jsonb,
              dashboard_widgets = $9::jsonb, demo = $10::jsonb, updated_at = now()
        where key = $1
        returning ${MODULE_COLUMNS}`,
      [
        manifest.key,
        manifest.version,
        digest,
        manifest.scopes,
        manifest.app.visible,
        JSON.stringify(manifest.requires),
        JSON.stringify(manifest.jobs),
        JSON.stringify(manifest.app_actions),
        JSON.stringify(manifest.dashboard_widgets),
        JSON.stringify(manifest.demo ?? null),
      ],
    );

    await syncModuleSettings(db, manifest, category);

    await enqueueEvent(db, {
      type: "module.upgraded",
      target: "admins",
      module_key: manifest.key,
      resource: toModuleView(updated[0]),
      payload: { from: installedVersion, to: manifest.version },
    });
    return toModuleView(updated[0]);
  });
}

/** Settings follow the new manifest: added, relabelled or removed; values stay. */
async function syncModuleSettings(
  db: QueryClient,
  manifest: ModuleManifest,
  category: string,
): Promise<void> {
  const keep: string[] = [];
  for (const group of manifest.settings) {
    await db.query(
      `insert into public.settings_categories
         (category_key, label, help, icon, sort_order, source)
       values ($1, $2, $3, $4, $5, $6)
       on conflict (category_key) do update
         set label = excluded.label, help = excluded.help,
             icon = excluded.icon, sort_order = excluded.sort_order`,
      [group.category, group.label, null, group.icon ?? null, group.sort_order, `module:${manifest.key}`],
    );
    for (const setting of group.settings) {
      keep.push(`${group.category}.${setting.key}`);
      await db.query(
        `insert into public.settings
           (category_key, key, label, help, value, is_secret, is_public, mcp_access, sort_order)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         on conflict (category_key, key) do update
           set label = excluded.label, help = excluded.help,
               is_secret = excluded.is_secret, is_public = excluded.is_public,
               mcp_access = excluded.mcp_access, sort_order = excluded.sort_order`,
        [
          group.category,
          `${group.category}.${setting.key}`,
          setting.label,
          setting.help ?? null,
          setting.is_secret ? null : JSON.stringify(setting.default ?? null),
          setting.is_secret,
          setting.is_public,
          setting.mcp_access,
          setting.sort_order,
        ],
      );
    }
  }
  if (manifest.settings.length === 0) {
    await db.query("delete from public.settings where category_key = $1", [category]);
    await db.query("delete from public.settings_categories where category_key = $1", [category]);
    return;
  }
  await db.query(
    "delete from public.settings where category_key = $1 and key <> all($2::text[])",
    [category, keep],
  );
}

export async function updateModule(
  deps: ModulesDeps,
  caller: Caller,
  key: string,
  input: { is_public?: boolean; mcp_exposed?: "none" | "read" | "read_write" },
): Promise<ModuleView> {
  if (!isAdmin(caller)) throw new DomainError("insufficient_scope");
  if (input.mcp_exposed === "read_write" && !isSuperAdmin(caller)) {
    throw new DomainError("insufficient_scope");
  }
  const sets: string[] = [];
  const params: unknown[] = [];
  if (input.is_public !== undefined) {
    params.push(input.is_public);
    sets.push(`is_public = $${params.length}`);
  }
  if (input.mcp_exposed !== undefined) {
    params.push(input.mcp_exposed);
    sets.push(`mcp_exposed = $${params.length}`);
  }
  if (sets.length === 0) return toModuleView(await getModuleRow(deps.db, key));
  params.push(key);
  const { rows } = await deps.db.query(
    `update public.module_registry
        set ${sets.join(", ")}, updated_at = now()
      where key = $${params.length}
      returning ${MODULE_COLUMNS}`,
    params,
  );
  if (!rows[0]) throw new DomainError("not_found");
  return toModuleView(rows[0]);
}

async function transitionOn(
  db: QueryClient,
  caller: Caller,
  key: string,
  target: ModuleState,
  from: ModuleState[],
): Promise<ModuleView> {
  if (!isAdmin(caller)) throw new DomainError("insufficient_scope");
  const { rows } = await db.query(
    `update public.module_registry
        set state = $1, updated_at = now()
      where key = $2 and state = any($3::text[])
      returning ${MODULE_COLUMNS}`,
    [target, key, from],
  );
  if (rows[0]) {
    await enqueueEvent(db, {
      type: target === "active" ? "module.activated" : "module.deactivated",
      target: "admins",
      module_key: key,
      resource: toModuleView(rows[0]),
    });
    return toModuleView(rows[0]);
  }
  const row = await getModuleRow(db, key);
  throw new DomainError("conflict", `Cannot move the module from ${String(row.state)} to ${target}`);
}

export async function activateModule(
  deps: ModulesDeps,
  caller: Caller,
  key: string,
): Promise<ModuleView> {
  return withTx(deps, async (db) => {
    const row = await getModuleRow(db, key);
    const { rows } = await db.query("select requires from public.module_registry where key = $1", [key]);
    const requires = (rows[0]?.requires as Requirement[] | undefined) ?? [];
    await assertRequirements(db, requires, "active");
    return transitionOn(db, caller, key, "active", ["installed", "disabled"]);
  });
}

export async function deactivateModule(
  deps: ModulesDeps,
  caller: Caller,
  key: string,
): Promise<ModuleView> {
  return withTx(deps, async (db) => {
    await assertNotRequired(db, key, ["active"]);
    return transitionOn(db, caller, key, "disabled", ["active"]);
  });
}

export async function uninstallModule(
  deps: ModulesDeps,
  caller: Caller,
  key: string,
  manifestValue: unknown,
  confirm: boolean,
): Promise<void> {
  if (!isSuperAdmin(caller)) throw new DomainError("insufficient_scope");
  const manifest = validateManifest(manifestValue);
  if (manifest.key !== key) throw new DomainError("validation_failed", "manifest does not match the key");
  const files = await verifyModuleFiles(deps, manifest);

  await withTx(deps, async (db) => {
    await getModuleRow(db, key);
    await assertNotRequired(db, key, ["installed", "active", "disabled"]);

    const { rows: usage } = await db.query(
      `select
         (select count(*)::int from public.user_modules
           where module_key = $1 and revoked_at is null) as grants,
         (select count(*)::int from public.user_category_modules
           where module_key = $1) as category_grants`,
      [key],
    );
    const grants = Number(usage[0]?.grants ?? 0) + Number(usage[0]?.category_grants ?? 0);
    if (grants > 0 && !confirm) {
      throw new DomainError("conflict", "Module has active grants; confirm the uninstall", {
        code: "grants_active",
      });
    }

    // A module that seeded demo data gets a last chance to clear it before the
    // schema goes; failures never block the uninstall.
    await clearDemoForModule(db, key);

    await db.query("delete from public.invitation_modules where module_key = $1", [key]);

    const { rows: applied } = await db.query(
      `select version from public.module_migrations
        where module_key = $1 and direction = 'up'`,
      [key],
    );
    const appliedVersions = new Set(applied.map((row) => String(row.version)));
    // Reverse the manifest order (the order they were applied), not a text sort.
    let reverted = 0;
    for (const migration of [...manifest.migrations].reverse()) {
      if (!appliedVersions.has(migration.version)) continue;
      reverted += 1;
      const sql = files.down.get(migration.version);
      if (!sql) throw new DomainError("conflict", `No down migration for version ${migration.version}`);
      await applySql(db, key, sql);
    }
    if (reverted !== appliedVersions.size) {
      throw new DomainError("conflict", "module has applied migrations missing from the manifest");
    }
    // The down migrations drop the module's objects; dropping the schema also
    // removes its grants, default privileges and anything the down forgot.
    await db.query(`drop schema if exists ${quoteIdent(schemaFor(key))} cascade`);

    const category = categoryFor(key);
    await db.query("delete from public.settings where category_key = $1", [category]);
    await db.query("delete from public.settings_categories where source = $1", [`module:${key}`]);
    await db.query("delete from public.translations where source = $1", [`module:${key}`]);
    await db.query("delete from public.module_registry where key = $1", [key]);
    await enqueueEvent(db, {
      type: "module.uninstalled",
      target: "admins",
      resource: { key },
    });
  });
}

/**
 * Scopes the caller holds for one module, or `null` when it has no access.
 *
 * The door uses this for module routes (option B): the route names its module
 * and the guard checks the grant against that module, so two modules that use
 * the same scope name never open each other's endpoints. Access mirrors
 * `listModules`: active module and (admin, public, or an active grant).
 */
export async function moduleScopesForCaller(
  deps: ModulesDeps,
  caller: Caller,
  key: string,
): Promise<readonly string[] | null> {
  if (!MODULE_KEY.test(key)) return null;
  const userId =
    caller.kind === "session" || caller.kind === "delegated" ? caller.userId : null;
  if (caller.kind === "anon") return null;
  if (!isAdmin(caller) && !userId) return null;
  const { rows } = await deps.db.query(
    `select m.scopes
       from public.module_registry m
      where m.key = $1
        and m.state = 'active'
        and ($2::boolean
             or m.is_public
             or exists (
               select 1 from public.user_modules u
                where u.user_id = $3 and u.module_key = m.key and u.revoked_at is null
             ))`,
    [key, isAdmin(caller), userId],
  );
  if (!rows[0]) return null;
  const scopes = rows[0].scopes;
  return Array.isArray(scopes) ? scopes.map(String) : [];
}

export async function getModuleSettings(
  deps: ModulesDeps,
  caller: Caller,
  key: string,
): Promise<ModuleSettingView[]> {
  if (!isAdmin(caller)) throw new DomainError("insufficient_scope");
  await getModuleRow(deps.db, key);
  const { rows } = await deps.db.query(
    `select category_key, key, label, help, value, value_encrypted, is_secret, is_public,
            mcp_access, sort_order, updated_at
       from public.settings
      where category_key = $1
      order by sort_order asc, key asc`,
    [categoryFor(key)],
  );
  return rows.map(toSettingView);
}

type SettingRules = {
  type: string;
  min?: number;
  max?: number;
  step?: number;
};

function validateSettingValue(setting: SettingRules, value: unknown): void {
  const type = setting.type;
  const fail = (): never => {
    throw new DomainError("validation_failed", `value does not match the setting type ${type}`);
  };
  switch (type) {
    case "int": {
      if (!Number.isInteger(value)) fail();
      const int = value as number;
      if (setting.min !== undefined && int < setting.min) fail();
      if (setting.max !== undefined && int > setting.max) fail();
      if (setting.step !== undefined && (int - (setting.min ?? 0)) % setting.step !== 0) fail();
      break;
    }
    case "bool":
      if (typeof value !== "boolean") fail();
      break;
    case "string":
      if (typeof value !== "string" || value.length > 2000) fail();
      break;
    case "url": {
      if (typeof value !== "string") fail();
      const text = String(value);
      if (text.length > 2000) fail();
      try {
        new URL(text);
      } catch {
        fail();
      }
      break;
    }
    case "currency":
      if (typeof value !== "string" || !/^[A-Z]{3}$/.test(value)) fail();
      break;
    case "locale":
      if (typeof value !== "string" || !["en", "es", "ca", "it", "fr", "de", "pt", "gl", "eu"].includes(value)) {
        fail();
      }
      break;
    case "json": {
      const serialized = JSON.stringify(value ?? null);
      if (serialized.length > 20_000) fail();
      break;
    }
    default:
      fail();
  }
}

export async function updateModuleSetting(
  deps: ModulesDeps,
  caller: Caller,
  key: string,
  input: { key: string; value: unknown },
  setting: SettingRules,
): Promise<ModuleSettingView> {
  validateSettingValue(setting, input.value);
  if (!isAdmin(caller)) throw new DomainError("insufficient_scope");
  await getModuleRow(deps.db, key);
  const category = categoryFor(key);
  const fullKey = input.key.includes(".") ? input.key : `${category}.${input.key}`;
  if (!fullKey.startsWith(`${category}.`)) throw new DomainError("not_found");

  const { rows: current } = await deps.db.query(
    `select is_secret from public.settings where category_key = $1 and key = $2`,
    [category, fullKey],
  );
  if (!current[0]) throw new DomainError("not_found");
  const isSecret = current[0].is_secret === true;
  const actor = actorFor(caller);

  let value: string | null = null;
  let encrypted: string | null = null;
  if (isSecret) {
    if (!deps.encryption) throw new DomainError("internal", "SETTINGS_ENCRYPTION_KEY is not configured");
    encrypted = await deps.encryption.encrypt(String(input.value), fullKey);
    if (encrypted === null) throw new DomainError("internal", "SETTINGS_ENCRYPTION_KEY is not usable");
  } else {
    value = JSON.stringify(input.value ?? null);
  }

  const { rows } = await deps.db.query(
    `update public.settings
        set value = $1, value_encrypted = $2, updated_by = $3, updated_by_key = $4, updated_at = now()
      where category_key = $5 and key = $6
      returning category_key, key, label, help, value, value_encrypted, is_secret, is_public,
                mcp_access, sort_order, updated_at`,
    [value, encrypted, actor.by, actor.byKey, category, fullKey],
  );
  if (!rows[0]) throw new DomainError("not_found");
  return toSettingView(rows[0]);
}

export async function listModuleGrants(
  deps: ModulesDeps,
  caller: Caller,
  key: string,
): Promise<ModuleGrants> {
  // The door already enforces `modules:manage`; the explicit role check keeps
  // the use case safe when it is called outside the API (same rule as the rest
  // of the module service).
  if (!isAdmin(caller)) throw new DomainError("insufficient_scope");
  if (!MODULE_KEY.test(key)) throw new DomainError("validation_failed", "invalid module key");
  // One statement for the module row (404) and both aggregates: no N+1 between
  // the users and their access, and empty grants are `[]`, never `null`.
  const { rows } = await deps.db.query(
    `select
       (select coalesce(json_agg(json_build_object('id', p.id, 'display_name', p.display_name)
                                 order by p.display_name asc, p.id asc), '[]'::json)
          from public.user_modules u
          join public.profiles p on p.id = u.user_id
         where u.module_key = $1 and u.revoked_at is null) as users,
       (select coalesce(json_agg(json_build_object('id', c.id, 'name', c.name)
                                 order by c.name asc, c.id asc), '[]'::json)
          from public.user_category_modules cm
          join public.user_categories c on c.id = cm.user_category_id
         where cm.module_key = $1) as categories
       from public.module_registry m
      where m.key = $1`,
    [key],
  );
  const row = rows[0];
  if (!row) throw new DomainError("not_found");
  return {
    users: (row.users as ModuleGrantUser[] | null) ?? [],
    categories: (row.categories as ModuleGrantCategory[] | null) ?? [],
  };
}

export async function grantUserModule(
  deps: ModulesDeps,
  caller: Caller,
  userId: string,
  moduleKey: string,
): Promise<void> {
  if (!isAdmin(caller)) throw new DomainError("insufficient_scope");
  if (!UUID.test(userId)) throw new DomainError("validation_failed", "invalid user id");
  await getModuleRow(deps.db, moduleKey);
  const { rows: user } = await deps.db.query("select 1 from public.profiles where id = $1", [userId]);
  if (!user[0]) throw new DomainError("not_found");
  const actor = actorFor(caller);
  await deps.db.query(
    `insert into public.user_modules (user_id, module_key, granted_by, granted_by_key)
     values ($1, $2, $3, $4)
     on conflict (user_id, module_key) do update
       set revoked_at = null, granted_by = excluded.granted_by, granted_by_key = excluded.granted_by_key`,
    [userId, moduleKey, actor.by, actor.byKey],
  );
}

export async function revokeUserModule(
  deps: ModulesDeps,
  caller: Caller,
  userId: string,
  moduleKey: string,
): Promise<void> {
  if (!isAdmin(caller)) throw new DomainError("insufficient_scope");
  if (!UUID.test(userId)) throw new DomainError("validation_failed", "invalid user id");
  await deps.db.query(
    `update public.user_modules set revoked_at = now()
      where user_id = $1 and module_key = $2 and revoked_at is null`,
    [userId, moduleKey],
  );
}
