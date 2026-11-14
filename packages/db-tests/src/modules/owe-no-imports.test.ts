import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { ClientBase } from "pg";
import { createTestUser, query, withClient } from "../pg.js";
import {
  activateModule,
  installModule,
  uninstallModule,
  type ModulesDeps,
} from "@027apps/core/modules/service.js";
import type { Caller } from "@027apps/core/api/types.js";
import { addMember, createGroup, listMembers, type OweDeps } from "@027apps/owe-no/domain/service.js";
import {
  commitImport,
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
  role: "admin" | "user",
  displayName: string,
): Promise<Caller & { kind: "session" }> {
  const { id } = await createTestUser(c, { email: email(displayName), role, displayName });
  return { kind: "session", userId: id, role };
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
        await uninstallModule(modulesDeps(c), admin, "owe-no", manifest, true);
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

      // A second run lists the duplicates and refuses without confirmation.
      const again = await previewImport(deps, ana.userId, group.id, CSV);
      expect(again.duplicates).toBe(2);
      await expect(commitImport(deps, ana.userId, group.id, CSV)).rejects.toMatchObject({
        code: "conflict",
        details: { code: "duplicates" },
      });
      const forced = await commitImport(deps, ana.userId, group.id, CSV, {
        confirmDuplicates: true,
      });
      expect(forced.skipped_duplicates).toBe(2);
      expect(await listImports(deps)).toHaveLength(2);

      // Only the creator imports.
      await expect(previewImport(deps, luis.userId, group.id, CSV)).rejects.toMatchObject({
        code: "forbidden",
      });
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
        await uninstallModule(modulesDeps(c), admin, "owe-no", manifest, true);
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
