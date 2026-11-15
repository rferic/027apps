import { describe, expect, it } from "vitest";
import type { ClientBase } from "pg";
import { createTestUser, impersonate, query, withClient } from "../pg.js";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import {
  activateModule,
  installModule,
  uninstallModule,
  type ModulesDeps,
} from "@027apps/core/modules/service.js";
import type { Caller } from "@027apps/core/api/types.js";

/**
 * The module's RLS is the second line: the API uses `service_role`, so these
 * policies only matter when someone talks to the database as `authenticated`.
 * They must agree with the domain, or they silently allow what it forbids and
 * forbid what it allows.
 */
const ROOT = resolve(fileURLToPath(new URL(".", import.meta.url)), "../../../owe-no");
const uniq = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

async function inRollback(fn: (c: ClientBase) => Promise<void>): Promise<void> {
  await withClient(async (c) => {
    await c.query("BEGIN");
    try {
      await fn(c);
    } finally {
      await c.query("ROLLBACK");
    }
  });
}

function modulesDeps(c: ClientBase): ModulesDeps {
  const db = { query: (sql: string, params: unknown[] = []) => query(c, sql, params) };
  return {
    db,
    withTransaction: async <T,>(fn: (tx: typeof db) => Promise<T>): Promise<T> => fn(db),
    moduleRoot: () => ROOT,
    readFile: (path) => readFile(path, "utf8"),
  };
}

async function setup(c: ClientBase) {
  const manifest = JSON.parse(await readFile(resolve(ROOT, "manifest.json"), "utf8"));
  const admin = await createTestUser(c, {
    email: `rls-owe-root-${uniq()}@test.local`,
    role: "super_admin",
  });
  const caller: Caller = { kind: "session", userId: admin.id, role: "super_admin" };
  const { rows: installed } = await query(
    c,
    "select 1 from public.module_registry where key = 'owe-no'",
  );
  if (installed[0]) {
    await uninstallModule(modulesDeps(c), caller, "owe-no", manifest, true);
  }
  await installModule(modulesDeps(c), caller, manifest);
  await activateModule(modulesDeps(c), caller, "owe-no");
  return manifest;
}

async function member(
  c: ClientBase,
  groupId: string,
  userId: string,
  state: "invited" | "active",
): Promise<string> {
  const { rows } = await query(
    c,
    `insert into module_owe_no.owe_no_members (group_id, user_id, display_name, state, joined_at)
     values ($1, $2, $3, $4, case when $4 = 'active' then now() end) returning id`,
    [groupId, userId, `Member ${uniq()}`, state],
  );
  return String(rows[0]!.id);
}

async function group(c: ClientBase, creatorId: string, archived = false): Promise<string> {
  const { rows } = await query(
    c,
    `insert into module_owe_no.owe_no_groups (name, currency, created_by, archived_at)
     values ($1, 'EUR', $2, case when $3 then now() end) returning id`,
    [`Group ${uniq()}`, creatorId, archived],
  );
  return String(rows[0]!.id);
}

describe("RLS: owe-no module", () => {
  it("lets an invited account see itself and accept, and hides the census", async () => {
    await inRollback(async (c) => {
      await setup(c);
      const owner = await createTestUser(c, { email: `rls-owe-o-${uniq()}@test.local`, role: "user" });
      const invited = await createTestUser(c, { email: `rls-owe-i-${uniq()}@test.local`, role: "user" });
      const gid = await group(c, owner.id);
      await member(c, gid, owner.id, "active");
      const self = await member(c, gid, invited.id, "invited");

      await impersonate(c, invited.id);
      // Its own row is visible, someone else's is not.
      const visible = await query(c, "select id from module_owe_no.owe_no_members");
      expect(visible.rows.map((row) => String(row.id))).toEqual([self]);

      // Accepting is an update of its own row: allowed.
      await c.query(
        "update module_owe_no.owe_no_members set state = 'active', joined_at = now() where id = $1",
        [self],
      );
      const { rows } = await query(c, "select state from module_owe_no.owe_no_members where id = $1", [self]);
      expect(rows[0]!.state).toBe("active");
    });
  });

  it("stops a member from rewriting another member's movement", async () => {
    await inRollback(async (c) => {
      await setup(c);
      const author = await createTestUser(c, { email: `rls-owe-a-${uniq()}@test.local`, role: "user" });
      const other = await createTestUser(c, { email: `rls-owe-b-${uniq()}@test.local`, role: "user" });
      const gid = await group(c, author.id);
      const authorMember = await member(c, gid, author.id, "active");
      await member(c, gid, other.id, "active");
      const { rows: movementRows } = await query(
        c,
        `insert into module_owe_no.owe_no_movements
           (group_id, kind, description, amount_minor, currency, paid_by_member_id, occurred_on, created_by)
         values ($1, 'expense', 'Cena', 1000, 'EUR', $2, current_date, $3) returning id`,
        [gid, authorMember, author.id],
      );
      const movementId = String(movementRows[0]!.id);

      await impersonate(c, other.id);
      const result = await c.query(
        "update module_owe_no.owe_no_movements set description = 'otra cosa' where id = $1",
        [movementId],
      );
      // RLS filters the row out of the UPDATE instead of raising: nothing changed.
      expect(result.rowCount).toBe(0);
    });
  });

  it("refuses new movements in an archived group", async () => {
    await inRollback(async (c) => {
      await setup(c);
      const owner = await createTestUser(c, { email: `rls-owe-z-${uniq()}@test.local`, role: "user" });
      const gid = await group(c, owner.id, true);
      const ownerMember = await member(c, gid, owner.id, "active");

      await impersonate(c, owner.id);
      await expect(
        c.query(
          `insert into module_owe_no.owe_no_movements
             (group_id, kind, description, amount_minor, currency, paid_by_member_id, occurred_on, created_by)
           values ($1, 'expense', 'Tarde', 500, 'EUR', $2, current_date, $3)`,
          [gid, ownerMember, owner.id],
        ),
      ).rejects.toThrow();
    });
  });
});
