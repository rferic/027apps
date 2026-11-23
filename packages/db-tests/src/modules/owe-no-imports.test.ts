import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { Client, type ClientBase } from "pg";
import { count, createTestUser, dbUrl, query, withClient } from "../pg.js";
import {
  activateModule,
  installModule,
  uninstallModule,
  type ModulesDeps,
} from "@027apps/core/modules/service.js";
import type { Caller } from "@027apps/core/api/types.js";
import { addMember, createGroup, groupBalances, listMembers, type OweDb, type OweDeps } from "@027apps/owe-no/domain/service.js";
import {
  commitImport,
  importMappingOptions,
  listImports,
  previewImport,
} from "@027apps/owe-no/domain/importer.js";

const ROOT = resolve(fileURLToPath(new URL(".", import.meta.url)), "../../../owe-no");
const email = (name: string) => `oweno-imp-${name}-${Date.now()}-${Math.random()}@test.local`;

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
    withTransaction: async <T,>(fn: (tx: typeof db) => Promise<T>): Promise<T> => {
      await c.query("savepoint module_op");
      try {
        const result = await fn(db);
        await c.query("release savepoint module_op");
        return result;
      } catch (error) {
        await c.query("rollback to savepoint module_op");
        throw error;
      }
    },
    moduleRoot: () => ROOT,
    readFile: (path) => readFile(path, "utf8"),
  };
}

function oweDeps(c: ClientBase): OweDeps {
  const db = { query: (sql: string, params: unknown[] = []) => query(c, sql, params) };
  return {
    db,
    withTransaction: async <T,>(fn: (tx: typeof db) => Promise<T>): Promise<T> => {
      await c.query("savepoint owe_imp");
      try {
        const result = await fn(db);
        await c.query("release savepoint owe_imp");
        return result;
      } catch (error) {
        await c.query("rollback to savepoint owe_imp");
        throw error;
      }
    },
  };
}

async function session(
  c: ClientBase,
  role: "super_admin" | "admin" | "user",
  displayName: string,
): Promise<Caller & { kind: "session" }> {
  const { id } = await createTestUser(c, { email: email(displayName), role, displayName });
  return { kind: "session", userId: id, role };
}

/** Installs OweNo inside the test's rollback, whether it was already there. */
async function installOweNo(c: ClientBase): Promise<void> {
  const admin = await session(c, "admin", "Admin");
  const manifest = JSON.parse(await readFile(resolve(ROOT, "manifest.json"), "utf8"));
  const { rows: installed } = await query(
    c,
    "select 1 from public.module_registry where key = 'owe-no'",
  );
  if (installed[0]) {
    await uninstallModule(
      modulesDeps(c),
      await session(c, "super_admin", "Root"),
      "owe-no",
      manifest,
      true,
    );
  }
  await installModule(modulesDeps(c), admin, manifest);
  await activateModule(modulesDeps(c), admin, "owe-no");
}

const CSV = [
  "Fecha,Descripción,Categoría,Coste,Moneda,Ana,Luis",
  "2026-01-05,Compra,Alimentos,10.00,EUR,-5.00,5.00",
  "2026-01-06,Devolución,Pago,5.00,EUR,-5.00,5.00",
].join("\n");

describe("owe-no importer", () => {
  it("previews, commits once, dedupes and records the batch", async () => {
    await inRollback(async (c) => {
      const admin = await session(c, "admin", "Admin");
      const manifest = JSON.parse(await readFile(resolve(ROOT, "manifest.json"), "utf8"));
      const { rows: installed } = await query(
        c,
        "select 1 from public.module_registry where key = 'owe-no'",
      );
      if (installed[0]) {
        // Uninstalling is super-admin only; the local instance may already
        // have OweNo installed while CI starts from an empty database.
        await uninstallModule(
          modulesDeps(c),
          await session(c, "super_admin", "Root"),
          "owe-no",
          manifest,
          true,
        );
      }
      await installModule(modulesDeps(c), admin, manifest);
      await activateModule(modulesDeps(c), admin, "owe-no");

      const ana = await session(c, "user", "Ana");
      const luis = await session(c, "user", "Luis");
      const deps = oweDeps(c);
      const group = await createGroup(deps, ana.userId, { name: "Viaje", currency: "EUR" });
      await addMember(deps, ana.userId, group.id, {
        displayName: "Luis",
        inviteeId: luis.userId,
      });
      await query(
        c,
        "update module_owe_no.owe_no_members set state = 'active', joined_at = now() where user_id = $1",
        [luis.userId],
      );

      const preview = await previewImport(deps, ana.userId, group.id, CSV);
      expect(preview).toMatchObject({
        movements: 2,
        payments: 1,
        unresolved: [],
        duplicates: 0,
        currencies: ["EUR"],
      });

      // The panel's mapping select lists the group's own members, including the
      // creator (the owner asked why their account was missing), and the
      // accounts still outside the group as invitable choices.
      const members = await listMembers(deps, ana.userId, group.id);
      const anaMember = members.find((member) => member.user_id === ana.userId)!;
      const mapping = await importMappingOptions(deps, ana.userId, group.id);
      expect(mapping).toContainEqual({
        id: anaMember.id,
        display_name: "Ana",
        kind: "member",
      });
      expect(mapping.filter((option) => option.kind === "account").map((option) => option.id)).not.toContain(
        ana.userId,
      );

      const result = await commitImport(deps, ana.userId, group.id, CSV);
      expect(result).toMatchObject({ created: 2, skipped_duplicates: 0, errors: 0 });
      expect(result.categories).toBe(1);

      const { rows: movements } = await query(
        c,
        "select kind from module_owe_no.owe_no_movements where group_id = $1 order by occurred_on",
        [group.id],
      );
      expect(movements.map((row) => row.kind)).toEqual(["expense", "settlement"]);

      const history = await listImports(deps);
      expect(history).toHaveLength(1);
      expect(history[0]).toMatchObject({ group_name: "Viaje", created_count: 2 });

      // A second run skips what was already imported; it never doubles the debt.
      const again = await previewImport(deps, ana.userId, group.id, CSV);
      expect(again.duplicates).toBe(2);
      const repeat = await commitImport(deps, ana.userId, group.id, CSV);
      expect(repeat).toMatchObject({ created: 0, skipped_duplicates: 2 });
      const forced = await commitImport(deps, ana.userId, group.id, CSV, {
        confirmDuplicates: true,
      });
      expect(forced).toMatchObject({ created: 0, skipped_duplicates: 2 });
      expect(await listImports(deps)).toHaveLength(3);
      const { rows: stillTwo } = await query(
        c,
        "select count(*)::int as n from module_owe_no.owe_no_movements where group_id = $1",
        [group.id],
      );
      expect(stillTwo[0].n).toBe(2);

      // Only the creator imports.
      await expect(previewImport(deps, luis.userId, group.id, CSV)).rejects.toMatchObject({
        code: "forbidden",
      });
    });
  });

  it("imports two identical rows in the same file as two expenses", async () => {
    await inRollback(async (c) => {
      const admin = await session(c, "admin", "Admin");
      const manifest = JSON.parse(await readFile(resolve(ROOT, "manifest.json"), "utf8"));
      const { rows: installed } = await query(
        c,
        "select 1 from public.module_registry where key = 'owe-no'",
      );
      if (installed[0]) {
        await uninstallModule(
          modulesDeps(c),
          await session(c, "super_admin", "Root"),
          "owe-no",
          manifest,
          true,
        );
      }
      await installModule(modulesDeps(c), admin, manifest);
      await activateModule(modulesDeps(c), admin, "owe-no");

      const ana = await session(c, "user", "Ana");
      const luis = await session(c, "user", "Luis");
      const deps = oweDeps(c);
      const group = await createGroup(deps, ana.userId, { name: "Metro", currency: "EUR" });
      await addMember(deps, ana.userId, group.id, {
        displayName: "Ana",
        inviteeId: ana.userId,
      });
      await addMember(deps, ana.userId, group.id, {
        displayName: "Luis",
        inviteeId: luis.userId,
      });
      await query(
        c,
        "update module_owe_no.owe_no_members set state = 'active', joined_at = now() where state = 'invited'",
      );

      // Two tickets, same day, same amount: a real export carries them and the
      // tracking row for each one shares the same hash.
      const csv = [
        "Fecha,Descripción,Categoría,Coste,Moneda,Ana,Luis",
        "2026-05-10,Metro,Transporte,1.50,EUR,1.50,-1.50",
        "2026-05-10,Metro,Transporte,1.50,EUR,1.50,-1.50",
      ].join("\n");

      const result = await commitImport(deps, ana.userId, group.id, csv);
      expect(result).toMatchObject({ created: 2, errors: 0 });
      const { rows } = await query(
        c,
        "select count(*)::int as n from module_owe_no.owe_no_movements where group_id = $1",
        [group.id],
      );
      expect(rows[0].n).toBe(2);
    });
  });

  // Regression: the import created categories in its own transaction and then
  // opened another one per movement (the app's runner), which cannot see rows
  // that are not committed yet, so a new category failed the movement's FK.
  it("keeps every write of an import in the same transaction", async () => {
    await inRollback(async (c) => {
      const admin = await session(c, "admin", "Admin");
      const manifest = JSON.parse(await readFile(resolve(ROOT, "manifest.json"), "utf8"));
      const { rows: installed } = await query(
        c,
        "select 1 from public.module_registry where key = 'owe-no'",
      );
      if (installed[0]) {
        await uninstallModule(
          modulesDeps(c),
          await session(c, "super_admin", "Root"),
          "owe-no",
          manifest,
          true,
        );
      }
      await installModule(modulesDeps(c), admin, manifest);
      await activateModule(modulesDeps(c), admin, "owe-no");

      const ana = await session(c, "user", "Ana");
      const luis = await session(c, "user", "Luis");
      const base = oweDeps(c);
      const group = await createGroup(base, ana.userId, { name: "Viaje", currency: "EUR" });
      await addMember(base, ana.userId, group.id, { displayName: "Ana", inviteeId: ana.userId });
      await addMember(base, ana.userId, group.id, { displayName: "Luis", inviteeId: luis.userId });
      await query(
        c,
        "update module_owe_no.owe_no_members set state = 'active', joined_at = now() where state = 'invited'",
      );

      const csv = [
        "Fecha,Descripción,Categoría,Coste,Moneda,Ana,Luis",
        "2026-05-10,Cena,Categoría nueva,20.00,EUR,20.00,-20.00",
      ].join("\n");

      // One transaction for the whole import: a second call to the runner is the
      // bug (it cannot see the rows the first one has not committed yet).
      let calls = 0;
      const db = { query: (sql: string, params: unknown[] = []) => query(c, sql, params) };
      const deps = {
        ...base,
        db,
        withTransaction: async <T,>(fn: (tx: typeof db) => Promise<T>): Promise<T> => {
          calls += 1;
          if (calls > 1) throw new Error("an import must not open a second transaction");
          return fn(db);
        },
      };

      const result = await commitImport(deps, ana.userId, group.id, csv);
      expect(result).toMatchObject({ created: 1, errors: 0, categories: 1 });
      expect(calls).toBe(1);
    });
  });

  // The owner's case: the group already had movements and the import doubled
  // them, so the import needs a "start from scratch" that the caller opts into.
  it("replaces the group's data when reset is requested", async () => {
    await inRollback(async (c) => {
      const admin = await session(c, "admin", "Admin");
      const manifest = JSON.parse(await readFile(resolve(ROOT, "manifest.json"), "utf8"));
      const { rows: installed } = await query(
        c,
        "select 1 from public.module_registry where key = 'owe-no'",
      );
      if (installed[0]) {
        await uninstallModule(
          modulesDeps(c),
          await session(c, "super_admin", "Root"),
          "owe-no",
          manifest,
          true,
        );
      }
      await installModule(modulesDeps(c), admin, manifest);
      await activateModule(modulesDeps(c), admin, "owe-no");

      const ana = await session(c, "user", "Ana");
      const luis = await session(c, "user", "Luis");
      const deps = oweDeps(c);
      const group = await createGroup(deps, ana.userId, { name: "Casa", currency: "EUR" });
      await addMember(deps, ana.userId, group.id, { displayName: "Ana", inviteeId: ana.userId });
      await addMember(deps, ana.userId, group.id, { displayName: "Luis", inviteeId: luis.userId });
      await query(
        c,
        "update module_owe_no.owe_no_members set state = 'active', joined_at = now() where state = 'invited'",
      );

      const csv = [
        "Fecha,Descripción,Categoría,Coste,Moneda,Ana,Luis",
        "2026-05-10,Cena,Comida,20.00,EUR,20.00,-20.00",
      ].join("\n");

      await commitImport(deps, ana.userId, group.id, csv);
      // A second run with reset must leave exactly one movement, not two.
      const reset = await commitImport(deps, ana.userId, group.id, csv, { reset: true });
      expect(reset).toMatchObject({ created: 1, skipped_duplicates: 0 });
      const { rows } = await query(
        c,
        "select count(*)::int as n from module_owe_no.owe_no_movements where group_id = $1",
        [group.id],
      );
      expect(rows[0].n).toBe(1);
      const balances = await groupBalances(deps, group.id);
      expect([...balances.values()].reduce((sum, value) => sum + value, 0)).toBe(0);
    });
  });

  it("refuses another currency and an unmapped name", async () => {
    await inRollback(async (c) => {
      const admin = await session(c, "admin", "Admin");
      const manifest = JSON.parse(await readFile(resolve(ROOT, "manifest.json"), "utf8"));
      const { rows: installed } = await query(
        c,
        "select 1 from public.module_registry where key = 'owe-no'",
      );
      if (installed[0]) {
        // Uninstalling is super-admin only; the local instance may already
        // have OweNo installed while CI starts from an empty database.
        await uninstallModule(
          modulesDeps(c),
          await session(c, "super_admin", "Root"),
          "owe-no",
          manifest,
          true,
        );
      }
      await installModule(modulesDeps(c), admin, manifest);
      await activateModule(modulesDeps(c), admin, "owe-no");

      const ana = await session(c, "user", "Ana");
      const deps = oweDeps(c);
      const group = await createGroup(deps, ana.userId, { name: "Casa", currency: "EUR" });

      await expect(
        previewImport(
          deps,
          ana.userId,
          group.id,
          "Fecha,Descripción,Categoría,Coste,Moneda,Ana\n2026-01-01,Cena,General,10.00,USD,10.00\n2026-01-02,Cena,General,10.00,EUR,10.00",
        ),
      ).rejects.toMatchObject({ details: { code: "multi_currency" } });

      const unknown = "Fecha,Descripción,Categoría,Coste,Moneda,Ana,Pepe\n2026-01-01,Cena,General,10.00,EUR,-5.00,5.00";
      const preview = await previewImport(deps, ana.userId, group.id, unknown);
      expect(preview.unresolved).toEqual(["Pepe"]);
      await expect(commitImport(deps, ana.userId, group.id, unknown)).rejects.toMatchObject({
        details: { code: "unmapped_identity" },
      });

      // Mapping the unknown name to a real member makes it importable.
      const members = await listMembers(deps, ana.userId, group.id);
      const anaMember = members[0];
      const fictitious = await addMember(deps, ana.userId, group.id, { displayName: "Pepe" });
      await query(
        c,
        "update module_owe_no.owe_no_members set state = 'active', joined_at = now() where id = $1",
        [fictitious.id],
      );
      const result = await commitImport(deps, ana.userId, group.id, unknown, {
        mapping: { Ana: anaMember.id, Pepe: fictitious.id },
      });
      expect(result.created).toBe(1);
    });
  });
});

describe("owe-no reset with mapped members", () => {
  // Regression: reset deleted the fictitious members the panel had just created
  // for the mapping, and the import answered `unknown_member`.
  it("keeps the members the file uses when starting from scratch", async () => {
    await inRollback(async (c) => {
      const admin = await session(c, "admin", "Admin");
      const manifest = JSON.parse(await readFile(resolve(ROOT, "manifest.json"), "utf8"));
      const { rows: installed } = await query(
        c,
        "select 1 from public.module_registry where key = 'owe-no'",
      );
      if (installed[0]) {
        await uninstallModule(
          modulesDeps(c),
          await session(c, "super_admin", "Root"),
          "owe-no",
          manifest,
          true,
        );
      }
      await installModule(modulesDeps(c), admin, manifest);
      await activateModule(modulesDeps(c), admin, "owe-no");

      const ana = await session(c, "user", "Ana");
      const deps = oweDeps(c);
      const group = await createGroup(deps, ana.userId, { name: "Casa", currency: "EUR" });
      await addMember(deps, ana.userId, group.id, { displayName: "Ana", inviteeId: ana.userId });
      const bolli = await addMember(deps, ana.userId, group.id, { displayName: "Bolli" });
      await query(
        c,
        "update module_owe_no.owe_no_members set state = 'active', joined_at = now() where state = 'invited'",
      );

      const csv = [
        "Fecha,Descripción,Categoría,Coste,Moneda,Ana,Bolli",
        "2026-05-10,Cena,Comida,20.00,EUR,10.00,-10.00",
      ].join("\n");

      const result = await commitImport(deps, ana.userId, group.id, csv, {
        reset: true,
        mapping: { Bolli: bolli.id },
      });
      expect(result).toMatchObject({ created: 1, errors: 0 });
      const listed = await listMembers(deps, ana.userId, group.id);
      expect(listed.some((member) => member.id === bolli.id)).toBe(true);
    });
  });
});

describe("owe-no importer members", () => {
  async function setup(c: ClientBase) {
    const admin = await session(c, "admin", "Admin");
    const manifest = JSON.parse(await readFile(resolve(ROOT, "manifest.json"), "utf8"));
    const { rows: installed } = await query(
      c,
      "select 1 from public.module_registry where key = 'owe-no'",
    );
    // Reuse an existing install (rolled back with the test anyway); only a clean
    // database needs the install here.
    if (!installed[0]) {
      await installModule(modulesDeps(c), admin, manifest);
      await activateModule(modulesDeps(c), admin, "owe-no");
    }
    return admin;
  }

  it("creates the mapping's new members inside the commit", async () => {
    await inRollback(async (c) => {
      await setup(c);
      const ana = await session(c, "user", "Ana");
      const luis = await session(c, "user", "Luis");
      const deps = oweDeps(c);
      const group = await createGroup(deps, ana.userId, { name: "Casa", currency: "EUR" });

      const csv = [
        "Fecha,Descripción,Categoría,Coste,Moneda,Ana,Luis",
        "2026-03-01,Cena,Comida,20.00,EUR,-10.00,10.00",
      ].join("\n");

      const result = await commitImport(deps, ana.userId, group.id, csv, {
        newMembers: [{ name: "Luis", userId: luis.userId }],
      });

      expect(result).toMatchObject({ created: 1, errors: 0 });
      const members = await listMembers(deps, ana.userId, group.id);
      const invited = members.find((member) => member.display_name === "Luis");
      // A real account enters invited and is charged from the start (D15).
      expect(invited?.state).toBe("invited");
    });
  });

  it("rejects a new member whose name is not in the file", async () => {
    await inRollback(async (c) => {
      await setup(c);
      const ana = await session(c, "user", "Ana");
      const deps = oweDeps(c);
      const group = await createGroup(deps, ana.userId, { name: "Casa", currency: "EUR" });
      const csv = [
        "Fecha,Descripción,Categoría,Coste,Moneda,Ana,Luis",
        "2026-03-01,Cena,Comida,10.00,EUR,-5.00,5.00",
      ].join("\n");

      await expect(
        commitImport(deps, ana.userId, group.id, csv, {
          newMembers: [{ name: "Inventado" }],
        }),
      ).rejects.toMatchObject({ details: { code: "unmapped_identity" } });
    });
  });

  it("keeps a mapped member whose name differs from the CSV when resetting", async () => {
    await inRollback(async (c) => {
      await setup(c);
      const ana = await session(c, "user", "Ana");
      const deps = oweDeps(c);
      const group = await createGroup(deps, ana.userId, { name: "Casa", currency: "EUR" });
      // A person the group knows under a longer name than the CSV column.
      const bolli = await addMember(deps, ana.userId, group.id, { displayName: "Bolli García" });
      const csv = [
        "Fecha,Descripción,Categoría,Coste,Moneda,Ana,Bolli",
        "2026-03-01,Cena,Comida,10.00,EUR,-5.00,5.00",
      ].join("\n");

      const result = await commitImport(deps, ana.userId, group.id, csv, {
        reset: true,
        mapping: { Bolli: bolli.id },
      });

      // A reset deletes fictitious members the file no longer names; this one is
      // named by the client's mapping, so deleting it made the import fail.
      expect(result).toMatchObject({ created: 1, errors: 0 });
      const members = await listMembers(deps, ana.userId, group.id);
      expect(members.some((member) => member.id === bolli.id)).toBe(true);
    });
  });

  it("rejects the same name twice", async () => {
    await inRollback(async (c) => {
      await setup(c);
      const ana = await session(c, "user", "Ana");
      const deps = oweDeps(c);
      const group = await createGroup(deps, ana.userId, { name: "Casa", currency: "EUR" });
      const csv = [
        "Fecha,Descripción,Categoría,Coste,Moneda,Ana,Bolli",
        "2026-03-01,Cena,Comida,10.00,EUR,-5.00,5.00",
      ].join("\n");

      await expect(
        commitImport(deps, ana.userId, group.id, csv, {
          newMembers: [{ name: "Bolli" }, { name: "Bolli" }],
        }),
      ).rejects.toMatchObject({ details: { code: "duplicate_new_member" } });
    });
  });

  it("leaves no member behind when the commit fails after creating them", async () => {
    await inRollback(async (c) => {
      await setup(c);
      const ana = await session(c, "user", "Ana");
      const deps = oweDeps(c);
      const group = await createGroup(deps, ana.userId, { name: "Casa", currency: "EUR" });
      const csv = [
        "Fecha,Descripción,Categoría,Coste,Moneda,Ana,Bolli",
        "2026-03-01,Cena,Comida,10.00,EUR,-5.00,5.00",
      ].join("\n");

      // Fail after the member was created but before the batch is written.
      const run = deps.withTransaction!;
      const broken: OweDeps = {
        db: deps.db,
        withTransaction: (fn) =>
          run((tx) =>
            fn({
              query: async (sql: string, params: unknown[] = []) => {
                if (sql.includes("insert into module_owe_no.owe_no_imports")) {
                  throw new Error("db down");
                }
                return tx.query(sql, params);
              },
            }),
          ),
      };

      await expect(
        commitImport(broken, ana.userId, group.id, csv, { newMembers: [{ name: "Bolli" }] }),
      ).rejects.toThrow("db down");

      const members = await listMembers(deps, ana.userId, group.id);
      expect(members.some((member) => member.display_name === "Bolli")).toBe(false);
    });
  });
});


describe("owe-no importer idempotency", () => {
  const CSV = [
    "Fecha,Descripción,Categoría,Coste,Moneda,Ana,Luis",
    "2026-04-01,Cena,Comida,10.00,EUR,-5.00,5.00",
  ].join("\n");

  async function group(c: ClientBase) {
    await installOweNo(c);
    const ana = await session(c, "user", "Ana");
    const deps = oweDeps(c);
    const created = await createGroup(deps, ana.userId, { name: "Casa", currency: "EUR" });
    await addMember(deps, ana.userId, created.id, { displayName: "Luis" });
    return { ana, deps, groupId: created.id };
  }

  it("replays the same key and body without a second batch", async () => {
    await inRollback(async (c) => {
      const { ana, deps, groupId } = await group(c);

      const first = await commitImport(deps, ana.userId, groupId, CSV, {
        idempotencyKey: "import-retry-1",
      });
      const again = await commitImport(deps, ana.userId, groupId, CSV, {
        idempotencyKey: "import-retry-1",
      });

      expect(again).toEqual(first);
      await expect(
        count(c, "select count(*) from module_owe_no.owe_no_imports where group_id = $1", [groupId]),
      ).resolves.toBe(1);
      await expect(
        count(c, "select count(*) from module_owe_no.owe_no_movements where group_id = $1", [groupId]),
      ).resolves.toBe(1);
    });
  });

  it("rejects the same key with another body", async () => {
    await inRollback(async (c) => {
      const { ana, deps, groupId } = await group(c);
      await commitImport(deps, ana.userId, groupId, CSV, { idempotencyKey: "import-conflict" });

      await expect(
        commitImport(deps, ana.userId, groupId, CSV.replace("Cena", "Comida"), {
          idempotencyKey: "import-conflict",
        }),
      ).rejects.toMatchObject({ details: { code: "idempotency_key_reused" } });
    });
  });

  it("does not repeat a reset when the key is replayed", async () => {
    await inRollback(async (c) => {
      const { ana, deps, groupId } = await group(c);

      await commitImport(deps, ana.userId, groupId, CSV, {
        reset: true,
        idempotencyKey: "import-reset",
      });
      const replay = await commitImport(deps, ana.userId, groupId, CSV, {
        reset: true,
        idempotencyKey: "import-reset",
      });

      expect(replay.created).toBe(1);
      await expect(
        count(c, "select count(*) from module_owe_no.owe_no_movements where group_id = $1", [groupId]),
      ).resolves.toBe(1);
    });
  });
});

/**
 * Deps with a real connection per transaction, so two commits can overlap.
 * The rest of the suite uses savepoints on one connection, and a savepoint
 * cannot hold an advisory lock in another session.
 */
async function liveDeps(): Promise<{ deps: OweDeps; close: () => Promise<void> }> {
  const clients: Client[] = [];
  const open = async (): Promise<Client> => {
    const client = new Client({ connectionString: dbUrl() });
    await client.connect();
    clients.push(client);
    return client;
  };
  const base = await open();
  return {
    deps: {
      db: {
        query: (sql: string, params: unknown[] = []) => query(base, sql, params),
      },
      withTransaction: async <T,>(fn: (tx: OweDb) => Promise<T>): Promise<T> => {
        const client = await open();
        await client.query("BEGIN");
        try {
          const tx: OweDb = {
            query: (sql: string, params: unknown[] = []) => query(client, sql, params),
          };
          const result = await fn(tx);
          await client.query("COMMIT");
          return result;
        } catch (error) {
          await client.query("ROLLBACK");
          throw error;
        }
      },
    },
    close: async () => {
      for (const client of clients) await client.end();
    },
  };
}

/**
 * Removes a test group and everything hanging from it, in dependency order:
 * a single DELETE on the group can trip `owe_no_movements.paid_by_member_id`,
 * which has no cascade.
 */
async function deleteTestGroup(c: ClientBase, groupId: string): Promise<void> {
  await c.query(
    "delete from module_owe_no.owe_no_movement_shares where movement_id in (select id from module_owe_no.owe_no_movements where group_id = $1)",
    [groupId],
  );
  await c.query("delete from module_owe_no.owe_no_movements where group_id = $1", [groupId]);
  await c.query(
    "delete from module_owe_no.owe_no_import_rows where import_id in (select id from module_owe_no.owe_no_imports where group_id = $1)",
    [groupId],
  );
  await c.query("delete from module_owe_no.owe_no_imports where group_id = $1", [groupId]);
  await c.query("delete from module_owe_no.owe_no_idempotency where group_id = $1", [groupId]);
  await c.query("delete from module_owe_no.owe_no_categories where group_id = $1", [groupId]);
  await c.query("delete from module_owe_no.owe_no_blocks where group_id = $1", [groupId]);
  await c.query("delete from module_owe_no.owe_no_members where group_id = $1", [groupId]);
  await c.query("delete from module_owe_no.owe_no_groups where id = $1", [groupId]);
}

describe("owe-no importer concurrency", () => {
  it("two overlapping commits of the same file do not duplicate movements", async () => {
    const manifest = JSON.parse(await readFile(resolve(ROOT, "manifest.json"), "utf8"));
    const live: Array<{ close: () => Promise<void> }> = [];
    let blocker: Client | null = null;
    let monitor: Client | null = null;
    let adminId = "";
    let anaId = "";
    let groupId = "";
    let root: Caller | null = null;
    let installedByTest = false;

    try {
      await withClient(async (c) => {
        adminId = (
          await createTestUser(c, {
            email: email("race-root"),
            role: "super_admin",
            displayName: "Root",
          })
        ).id;
        anaId = (
          await createTestUser(c, {
            email: email("race-ana"),
            role: "user",
            displayName: "Ana",
          })
        ).id;
      });
      root = { kind: "session", userId: adminId, role: "super_admin" };

      // Never uninstall a module that was already there: it holds somebody's
      // data. CI starts from a clean database, so there the test installs it and
      // removes it again; on a configured instance it reuses the install.
      const { rows: registry } = await withClient((c) =>
        query(c, "select 1 from public.module_registry where key = 'owe-no'"),
      );
      installedByTest = registry.length === 0;
      if (installedByTest) {
        await withClient(async (c) => {
          await c.query("BEGIN");
          try {
            await installModule(modulesDeps(c), root!, manifest);
            await activateModule(modulesDeps(c), root!, "owe-no");
            await c.query("COMMIT");
          } catch (error) {
            await c.query("ROLLBACK");
            throw error;
          }
        });
      }

      // Committed: the two overlapping transactions must see it from their own
      // connections, which a rollback transaction cannot provide.
      await withClient(async (c) => {
        await c.query("BEGIN");
        try {
          const deps = oweDeps(c);
          const group = await createGroup(deps, anaId, { name: "Carrera", currency: "EUR" });
          groupId = group.id;
          await addMember(deps, anaId, groupId, { displayName: "Luis" });
          await c.query("COMMIT");
        } catch (error) {
          await c.query("ROLLBACK");
          throw error;
        }
      });

      const csv = [
        "Fecha,Descripción,Categoría,Coste,Moneda,Ana,Luis",
        "2026-02-01,Cena,Comida,10.00,EUR,-5.00,5.00",
        "2026-02-02,Cine,Ocio,8.00,EUR,-4.00,4.00",
      ].join("\n");

      // Hold the group's lock so both commits queue behind it. Whichever reads
      // the hashes before taking the lock will see an empty set and duplicate.
      blocker = new Client({ connectionString: dbUrl() });
      await blocker.connect();
      await blocker.query("BEGIN");
      await blocker.query("select pg_advisory_xact_lock(hashtext($1::text))", [groupId]);

      const first = await liveDeps();
      const second = await liveDeps();
      live.push(first, second);
      const commits = [
        commitImport(first.deps, anaId, groupId, csv),
        commitImport(second.deps, anaId, groupId, csv),
      ];
      // Attach the handlers now: if an assertion below throws before the wait,
      // an early rejection must not become an unhandled one.
      const settled = Promise.allSettled(commits);

      monitor = new Client({ connectionString: dbUrl() });
      await monitor.connect();
      const deadline = Date.now() + 5_000;
      let waiting = 0;
      while (Date.now() < deadline) {
        waiting = await count(
          monitor,
          `select count(*) from pg_stat_activity
            where datname = current_database()
              and wait_event_type = 'Lock'
              and query ilike '%pg_advisory_xact_lock%'`,
        );
        if (waiting >= 2) break;
        await new Promise((wake) => setTimeout(wake, 25));
      }
      expect(waiting).toBeGreaterThanOrEqual(2);

      await blocker.query("ROLLBACK");
      const results = await settled;
      expect(results.map((result) => result.status)).toEqual(["fulfilled", "fulfilled"]);

      await withClient(async (c) => {
        const movements = await count(
          c,
          "select count(*) from module_owe_no.owe_no_movements where group_id = $1",
          [groupId],
        );
        expect(movements).toBe(2);
        const tracked = await count(
          c,
          `select count(*) from module_owe_no.owe_no_import_rows r
             join module_owe_no.owe_no_imports i on i.id = r.import_id
            where i.group_id = $1`,
          [groupId],
        );
        expect(tracked).toBe(2);
      });
    } finally {
      for (const item of live) await item.close().catch(() => undefined);
      if (blocker) {
        await blocker.query("ROLLBACK").catch(() => undefined);
        await blocker.end().catch(() => undefined);
      }
      if (monitor) await monitor.end().catch(() => undefined);
      await withClient(async (c) => {
        await c.query("BEGIN");
        try {
          if (groupId) {
            await deleteTestGroup(c, groupId);
            await c.query("delete from public.event_outbox where resource->>'group_id' = $1", [
              groupId,
            ]);
          }
          if (adminId) {
            await c.query("delete from public.profiles where id = any($1::uuid[])", [
              [adminId, anaId],
            ]);
            await c.query("delete from auth.users where id = any($1::uuid[])", [
              [adminId, anaId],
            ]);
          }
          // Only the install this test created, never somebody's real module.
          if (installedByTest && root) {
            await uninstallModule(modulesDeps(c), root, "owe-no", manifest, true);
          }
          await c.query("COMMIT");
        } catch (error) {
          await c.query("ROLLBACK");
          throw error;
        }
      }).catch(() => undefined);
    }
  });
});
