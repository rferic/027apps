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
import {
  adminAddMember,
  adminCreateGroup,
  adminCreateMovement,
  adminDeleteMovement,
  adminGroupDetail,
  adminLinkMember,
  adminRemoveMember,
  adminSetArchived,
  adminSettlementPlan,
  adminUpdateMovement,
} from "@027apps/owe-no/domain/admin.js";
import {
  OweDomainError,
  groupBalances,
  type OweDeps,
} from "@027apps/owe-no/domain/service.js";
import type { Caller } from "@027apps/core/api/types.js";

const ROOT = resolve(fileURLToPath(new URL(".", import.meta.url)), "../../../owe-no");
const email = (name: string) => `oweadm-${name}-${Date.now()}-${Math.random()}@test.local`;

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
      await c.query("savepoint owe_admin");
      try {
        const result = await fn(db);
        await c.query("release savepoint owe_admin");
        return result;
      } catch (error) {
        await c.query("rollback to savepoint owe_admin");
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
    withTransaction: async <T,>(fn: (tx: typeof db) => Promise<T>): Promise<T> => fn(db),
  };
}

async function install(c: ClientBase) {
  const manifest = JSON.parse(await readFile(resolve(ROOT, "manifest.json"), "utf8"));
  const { rows: installed } = await query(
    c,
    "select 1 from public.module_registry where key = 'owe-no'",
  );
  if (installed[0]) {
    const { id } = await createTestUser(c, { email: email("root"), role: "super_admin" });
    await uninstallModule(
      modulesDeps(c),
      { kind: "session", userId: id, role: "super_admin" },
      "owe-no",
      manifest,
      true,
    );
  }
  const { id } = await createTestUser(c, { email: email("admin"), role: "admin" });
  const admin: Caller = { kind: "session", userId: id, role: "admin" };
  await installModule(modulesDeps(c), admin, manifest);
  await activateModule(modulesDeps(c), admin, "owe-no");
  return { admin, adminId: id };
}

async function user(c: ClientBase, name: string) {
  const { id } = await createTestUser(c, { email: email(name), role: "user", displayName: name });
  return { id, caller: { kind: "session", userId: id, role: "user" } as Caller };
}

describe("owe-no administration", () => {
  it("refuses a member session and accepts an admin one", async () => {
    await inRollback(async (c) => {
      const { admin } = await install(c);
      const ana = await user(c, "Ana");
      const group = await adminCreateGroup(oweDeps(c), admin, { name: "Casa", currency: "EUR" });

      await expect(adminGroupDetail(oweDeps(c), ana.caller, group.id)).rejects.toMatchObject({
        code: "forbidden",
      });
      const detail = await adminGroupDetail(oweDeps(c), admin, group.id);
      expect(detail.group.name).toBe("Casa");
      expect(detail.members).toHaveLength(1);
      expect(detail.members[0].state).toBe("active");
    });
  });

  it("adds fictitious members and links them to an account", async () => {
    await inRollback(async (c) => {
      const { admin } = await install(c);
      const luis = await user(c, "Luis");
      const group = await adminCreateGroup(oweDeps(c), admin, { name: "Casa", currency: "EUR" });

      const fictitious = await adminAddMember(oweDeps(c), admin, group.id, {
        displayName: "Marta",
      });
      expect(fictitious.user_id).toBeNull();

      await adminLinkMember(oweDeps(c), admin, group.id, fictitious.id, luis.id);
      const detail = await adminGroupDetail(oweDeps(c), admin, group.id);
      expect(detail.members.find((member) => member.id === fictitious.id)?.user_id).toBe(luis.id);

      const { rows: events } = await query(
        c,
        "select type from public.event_outbox where type = 'owe_no.member_linked' and module_key = 'owe-no'",
      );
      expect(events).toHaveLength(1);
    });
  });

  it("creates, edits and soft-deletes a movement with audit and fresh shares", async () => {
    await inRollback(async (c) => {
      const { admin, adminId } = await install(c);
      const luis = await user(c, "Luis");
      const group = await adminCreateGroup(oweDeps(c), admin, { name: "Casa", currency: "EUR" });
      const luisMember = await adminAddMember(oweDeps(c), admin, group.id, {
        displayName: "Luis",
        userId: luis.id,
      });
      const { members } = await adminGroupDetail(oweDeps(c), admin, group.id);
      const adminMember = members.find((member) => member.user_id === adminId)!;

      const created = await adminCreateMovement(oweDeps(c), admin, group.id, {
        kind: "expense",
        description: "Cena",
        amount_minor: 1000,
        occurred_on: "2026-11-14",
        paid_by: adminMember.id,
        participants: [{ memberId: adminMember.id }, { memberId: luisMember.id }],
      });
      const shareOf = (shares: Array<{ memberId: string; amount_minor: number }>) =>
        new Map(shares.map((share) => [share.memberId, share.amount_minor]));
      expect(shareOf(created.shares)).toEqual(
        new Map([
          [adminMember.id, 500],
          [luisMember.id, 500],
        ]),
      );

      const edited = await adminUpdateMovement(oweDeps(c), admin, group.id, created.id, {
        kind: "expense",
        description: "Cena",
        amount_minor: 1200,
        occurred_on: "2026-11-14",
        paid_by: adminMember.id,
        participants: [{ memberId: adminMember.id }, { memberId: luisMember.id }],
      });
      expect(shareOf(edited.shares)).toEqual(
        new Map([
          [adminMember.id, 600],
          [luisMember.id, 600],
        ]),
      );

      const { rows: audit } = await query(
        c,
        "select created_by, updated_by from module_owe_no.owe_no_movements where id = $1",
        [created.id],
      );
      expect(audit[0]).toMatchObject({ created_by: adminId, updated_by: adminId });

      await adminDeleteMovement(oweDeps(c), admin, group.id, created.id);
      const { rows: deleted } = await query(
        c,
        "select deleted_at, deleted_by from module_owe_no.owe_no_movements where id = $1",
        [created.id],
      );
      expect(deleted[0].deleted_at).not.toBeNull();
      expect(deleted[0].deleted_by).toBe(adminId);
      expect((await groupBalances(oweDeps(c), group.id)).get(luisMember.id)).toBe(0);
    });
  });

  it("records a settlement from the plan and leaves the group at zero", async () => {
    await inRollback(async (c) => {
      const { admin, adminId } = await install(c);
      const luis = await user(c, "Luis");
      const group = await adminCreateGroup(oweDeps(c), admin, { name: "Casa", currency: "EUR" });
      const luisMember = await adminAddMember(oweDeps(c), admin, group.id, {
        displayName: "Luis",
        userId: luis.id,
      });
      const { members } = await adminGroupDetail(oweDeps(c), admin, group.id);
      const adminMember = members.find((member) => member.user_id === adminId)!;

      await adminCreateMovement(oweDeps(c), admin, group.id, {
        kind: "expense",
        description: "Compra",
        amount_minor: 2000,
        occurred_on: "2026-11-14",
        paid_by: adminMember.id,
        participants: [{ memberId: adminMember.id }, { memberId: luisMember.id }],
      });

      const plan = await adminSettlementPlan(oweDeps(c), admin, group.id);
      expect(plan.exact).toBe(true);
      expect(plan.transfers).toEqual([
        { from: luisMember.id, to: adminMember.id, amount_minor: 1000 },
      ]);

      await adminCreateMovement(oweDeps(c), admin, group.id, {
        kind: "settlement",
        description: "Pago",
        amount_minor: 1000,
        occurred_on: "2026-11-14",
        paid_by: luisMember.id,
        participants: [{ memberId: adminMember.id, amount_minor: 1000 }],
      });

      const balances = await groupBalances(oweDeps(c), group.id);
      expect(balances.get(luisMember.id)).toBe(0);
      expect(balances.get(adminMember.id)).toBe(0);
    });
  });

  it("keeps an archived group read-only and blocks removing a member with balance", async () => {
    await inRollback(async (c) => {
      const { admin, adminId } = await install(c);
      const luis = await user(c, "Luis");
      const group = await adminCreateGroup(oweDeps(c), admin, { name: "Casa", currency: "EUR" });
      const luisMember = await adminAddMember(oweDeps(c), admin, group.id, {
        displayName: "Luis",
        userId: luis.id,
      });
      const { members } = await adminGroupDetail(oweDeps(c), admin, group.id);
      const adminMember = members.find((member) => member.user_id === adminId)!;

      await adminCreateMovement(oweDeps(c), admin, group.id, {
        kind: "expense",
        description: "Compra",
        amount_minor: 1200,
        occurred_on: "2026-11-14",
        paid_by: adminMember.id,
        participants: [{ memberId: adminMember.id }, { memberId: luisMember.id }],
      });

      await adminSetArchived(oweDeps(c), admin, group.id, true);
      await expect(
        adminCreateMovement(oweDeps(c), admin, group.id, {
          kind: "expense",
          description: "Tarde",
          amount_minor: 100,
          occurred_on: "2026-11-15",
          paid_by: adminMember.id,
          participants: [{ memberId: adminMember.id }],
        }),
      ).rejects.toMatchObject({ code: "conflict" });

      await adminSetArchived(oweDeps(c), admin, group.id, false);
      await expect(
        adminRemoveMember(oweDeps(c), admin, group.id, luisMember.id),
      ).rejects.toMatchObject({ code: "conflict" });

      await adminCreateMovement(oweDeps(c), admin, group.id, {
        kind: "settlement",
        description: "Pago",
        amount_minor: 500,
        occurred_on: "2026-11-15",
        paid_by: luisMember.id,
        participants: [{ memberId: adminMember.id, amount_minor: 500 }],
      });
      await expect(
        adminRemoveMember(oweDeps(c), admin, group.id, luisMember.id),
      ).rejects.toMatchObject({ code: "conflict" });

      await adminCreateMovement(oweDeps(c), admin, group.id, {
        kind: "settlement",
        description: "Pago",
        amount_minor: 100,
        occurred_on: "2026-11-15",
        paid_by: luisMember.id,
        participants: [{ memberId: adminMember.id, amount_minor: 100 }],
      });
      await adminRemoveMember(oweDeps(c), admin, group.id, luisMember.id);
      const detail = await adminGroupDetail(oweDeps(c), admin, group.id);
      expect(detail.members.find((member) => member.id === luisMember.id)?.state).toBe("removed");
    });
  });

  it("reads the widget numbers and the balance view from the same data", async () => {
    await inRollback(async (c) => {
      const { admin, adminId } = await install(c);
      const group = await adminCreateGroup(oweDeps(c), admin, { name: "Casa", currency: "EUR" });
      const { members } = await adminGroupDetail(oweDeps(c), admin, group.id);
      const adminMember = members.find((member) => member.user_id === adminId)!;
      await adminCreateMovement(oweDeps(c), admin, group.id, {
        kind: "expense",
        description: "Compra",
        amount_minor: 900,
        occurred_on: "2026-11-14",
        paid_by: adminMember.id,
        participants: [{ memberId: adminMember.id }],
      });

      // Module SQL resolves its own tables through the caller's search_path,
      // exactly as the Core's widget resolver sets it.
      await c.query("set local search_path to module_owe_no, public");
      const { rows } = await query(
        c,
        `select widget_metric(null) as groups,
                widget_pending(null) as pending`,
      );
      const groups = rows[0].groups as { value: number; params: Record<string, number> };
      const pending = rows[0].pending as { value: number };
      expect(groups.value).toBe(1);
      expect(groups.params.members).toBe(1);
      expect(groups.params.movements).toBe(1);
      // A single member paying for themselves nets zero: nothing is pending.
      expect(pending.value).toBe(0);

      const { rows: view } = await query(
        c,
        "select member_id, amount_minor from module_owe_no.owe_no_balances where group_id = $1",
        [group.id],
      );
      const fromView = new Map(view.map((row) => [String(row.member_id), Number(row.amount_minor)]));
      expect(fromView).toEqual(await groupBalances(oweDeps(c), group.id));
    });
  });

  it("brings a removed account back instead of refusing it", async () => {
    await inRollback(async (c) => {
      const { admin } = await install(c);
      const luis = await user(c, "Luis");
      const group = await adminCreateGroup(oweDeps(c), admin, { name: "Casa", currency: "EUR" });
      const first = await adminAddMember(oweDeps(c), admin, group.id, {
        displayName: "Luis",
        userId: luis.id,
      });
      await adminRemoveMember(oweDeps(c), admin, group.id, first.id);

      const again = await adminAddMember(oweDeps(c), admin, group.id, {
        displayName: "Luis",
        userId: luis.id,
      });
      expect(again.id).toBe(first.id);
      expect(again.state).toBe("active");
    });
  });

  it("never removes the last active member", async () => {
    await inRollback(async (c) => {
      const { admin } = await install(c);
      const group = await adminCreateGroup(oweDeps(c), admin, { name: "Casa", currency: "EUR" });
      const { members } = await adminGroupDetail(oweDeps(c), admin, group.id);
      await expect(
        adminRemoveMember(oweDeps(c), admin, group.id, members[0].id),
      ).rejects.toMatchObject({ code: "conflict" });
    });
  });
});

