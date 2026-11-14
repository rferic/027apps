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
import {
  addMember,
  addMovement,
  acceptInvitation,
  balances,
  createGroup,
  deleteMovement,
  listGroups,
  listMembers,
  listMovements,
  settlementPlan,
  type OweDeps,
} from "@027apps/owe-no/domain/service.js";

const ROOT = resolve(fileURLToPath(new URL(".", import.meta.url)), "../../../owe-no");
const email = (name: string) => `oweno-${name}-${Date.now()}-${Math.random()}@test.local`;

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
      await c.query("savepoint owe_op");
      try {
        const result = await fn(db);
        await c.query("release savepoint owe_op");
        return result;
      } catch (error) {
        await c.query("rollback to savepoint owe_op");
        throw error;
      }
    },
  };
}

async function session(
  c: ClientBase,
  role: "super_admin" | "admin" | "user",
): Promise<Caller & { kind: "session" }> {
  const { id } = await createTestUser(c, { email: email(role), role });
  return { kind: "session", userId: id, role };
}

describe("owe-no service", () => {
  it("creates a group, splits an expense, settles it and hides it from outsiders", async () => {
    await inRollback(async (c) => {
      const admin = await session(c, "admin");
      const manifest = JSON.parse(await readFile(resolve(ROOT, "manifest.json"), "utf8"));
      const { rows: installed } = await query(
        c,
        "select state from public.module_registry where key = 'owe-no'",
      );
      if (installed[0]) {
        await uninstallModule(modulesDeps(c), await session(c, "super_admin"), "owe-no", manifest, true);
      }
      await installModule(modulesDeps(c), admin, manifest);
      await activateModule(modulesDeps(c), admin, "owe-no");

      const ana = await session(c, "user");
      const luis = await session(c, "user");
      const marta = await session(c, "user");
      const deps = oweDeps(c);

      const group = await createGroup(deps, ana.userId, { name: "Casa", currency: "EUR" });
      expect(group.role).toBe("active");
      expect((await listGroups(deps, ana.userId)).map((row) => row.id)).toEqual([group.id]);

      const invited = await addMember(deps, ana.userId, group.id, {
        displayName: "Luis",
        inviteeId: luis.userId,
      });
      expect(invited.kind).toBe("user");
      // An invited member sees the group but cannot read the movements yet.
      await expect(listMovements(deps, luis.userId, group.id)).rejects.toThrow(/not active/);
      await acceptInvitation(deps, luis.userId, group.id);

      const members = await listMembers(deps, ana.userId, group.id);
      const anaMember = members.find((member) => member.user_id === ana.userId)!;
      const luisMember = members.find((member) => member.user_id === luis.userId)!;
      expect(members.every((member) => member.state === "active")).toBe(true);

      const expense = await addMovement(deps, ana.userId, group.id, {
        kind: "expense",
        description: "Compra",
        amount_minor: 901,
        occurred_on: "2026-11-14",
        paid_by: anaMember.id,
        participants: [{ memberId: anaMember.id }, { memberId: luisMember.id }],
      });
      // 901 split in two: the first share by member id takes the extra cent.
      const shares = expense.shares.map((share) => share.amount_minor).sort((a, b) => a - b);
      expect(shares).toEqual([450, 451]);

      const afterExpense = await balances(deps, ana.userId, group.id);
      expect(afterExpense.get(anaMember.id)! + afterExpense.get(luisMember.id)!).toBe(0);

      const plan = await settlementPlan(deps, ana.userId, group.id);
      expect(plan.exact).toBe(true);
      expect(plan.transfers).toHaveLength(1);
      expect(plan.transfers[0].amount_minor).toBe(
        Math.abs(afterExpense.get(luisMember.id)!),
      );

      // Luis pays what he owes; the group is square again.
      await addMovement(deps, luis.userId, group.id, {
        kind: "settlement",
        description: "Devolución",
        amount_minor: Math.abs(afterExpense.get(luisMember.id)!),
        occurred_on: "2026-11-14",
        paid_by: luisMember.id,
        participants: [{ memberId: anaMember.id }],
      });
      const settled = await balances(deps, ana.userId, group.id);
      expect([...settled.values()].every((amount) => amount === 0)).toBe(true);

      // Soft delete takes the expense out of the history and the balances.
      await deleteMovement(deps, ana.userId, group.id, expense.id);
      expect(await listMovements(deps, ana.userId, group.id)).toHaveLength(1);
      const afterDelete = await balances(deps, ana.userId, group.id);
      expect([...afterDelete.values()].some((amount) => amount !== 0)).toBe(true);

      // An outsider sees nothing, not even the group.
      await expect(listMovements(deps, marta.userId, group.id)).rejects.toThrow(/not found/);
      expect(await listGroups(deps, marta.userId)).toEqual([]);
    });
  });
});
