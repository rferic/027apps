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
  addMember,
  blockMember,
  createGroup,
  groupBalances,
  leaveGroup,
  listMembers,
  removeMember,
  unblockMember,
  declineInvitation,
} from "@027apps/owe-no/domain/service.js";
import type { Caller } from "@027apps/core/api/types.js";

const ROOT = resolve(fileURLToPath(new URL(".", import.meta.url)), "../../../owe-no");
const email = (name: string) => `owemem-${name}-${Date.now()}-${Math.random()}@test.local`;

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

function deps(c: ClientBase) {
  const db = { query: (sql: string, params: unknown[] = []) => query(c, sql, params) };
  return { db, withTransaction: async <T,>(fn: (tx: typeof db) => Promise<T>): Promise<T> => fn(db) };
}

async function setup(c: ClientBase) {
  const manifest = JSON.parse(await readFile(resolve(ROOT, "manifest.json"), "utf8"));
  const first = await createTestUser(c, { email: email("root"), role: "super_admin" });
  const admin: Caller = { kind: "session", userId: first.id, role: "super_admin" };
  const { rows: installed } = await query(
    c,
    "select 1 from public.module_registry where key = 'owe-no'",
  );
  if (installed[0]) {
    await uninstallModule(modulesDeps(c), admin, "owe-no", manifest, true);
  }
  await installModule(modulesDeps(c), admin, manifest);
  await activateModule(modulesDeps(c), admin, "owe-no");
  const owner = await createTestUser(c, { email: email("owner"), role: "user", displayName: "Owner" });
  const group = await createGroup(deps(c), owner.id, { name: "Casa", currency: "EUR" });
  return { group, owner };
}

async function other(c: ClientBase, name: string) {
  const { id } = await createTestUser(c, { email: email(name), role: "user", displayName: name });
  return id;
}

describe("owe-no member lifecycle", () => {
  it("lets a member leave with a zero balance", async () => {
    await inRollback(async (c) => {
      const { group, owner } = await setup(c);
      const luis = await other(c, "Luis");
      const member = await addMember(deps(c), owner.id, group.id, {
        displayName: "Luis",
        inviteeId: luis,
      });
      await c.query("update module_owe_no.owe_no_members set state = 'active' where id = $1", [
        member.id,
      ]);
      await leaveGroup(deps(c), luis, group.id);
      const members = await listMembers(deps(c), owner.id, group.id);
      expect(members.find((row) => row.id === member.id)?.state).toBe("left");
    });
  });

  it("refuses to leave with a pending balance", async () => {
    await inRollback(async (c) => {
      const { group, owner } = await setup(c);
      await c.query(
        `insert into module_owe_no.owe_no_movements
           (group_id, kind, description, amount_minor, currency, paid_by_member_id, occurred_on, created_by)
         select $1, 'expense', 'Cena', 1000, 'EUR', m.id, current_date, $2
           from module_owe_no.owe_no_members m where m.group_id = $1 and m.user_id = $2`,
        [group.id, owner.id],
      );
      await expect(leaveGroup(deps(c), owner.id, group.id)).rejects.toMatchObject({
        code: "conflict",
        details: { code: "member_has_balance" },
      });
    });
  });

  it("hands the group to another account when the creator leaves", async () => {
    await inRollback(async (c) => {
      const { group, owner } = await setup(c);
      const luis = await other(c, "Luis");
      const member = await addMember(deps(c), owner.id, group.id, {
        displayName: "Luis",
        inviteeId: luis,
      });
      await c.query("update module_owe_no.owe_no_members set state = 'active' where id = $1", [
        member.id,
      ]);
      await leaveGroup(deps(c), owner.id, group.id);
      const { rows } = await query(c, "select created_by from module_owe_no.owe_no_groups where id = $1", [
        group.id,
      ]);
      expect(rows[0].created_by).toBe(luis);
    });
  });

  it("removes a member with zero balance and never the last one", async () => {
    await inRollback(async (c) => {
      const { group, owner } = await setup(c);
      const fictitious = await addMember(deps(c), owner.id, group.id, { displayName: "Marta" });
      await c.query("update module_owe_no.owe_no_members set state = 'active' where id = $1", [
        fictitious.id,
      ]);
      await removeMember(deps(c), owner.id, group.id, fictitious.id);
      await expect(removeMember(deps(c), owner.id, group.id, fictitious.id)).rejects.toMatchObject({
        code: "not_found",
      });
      const { rows } = await query(
        c,
        "select id from module_owe_no.owe_no_members where group_id = $1 and state = 'active'",
        [group.id],
      );
      await expect(removeMember(deps(c), owner.id, group.id, rows[0].id)).rejects.toMatchObject({
        code: "conflict",
        details: { code: "cannot_remove_self" },
      });
    });
  });

  it("blocks and unblocks an account, refusing it while blocked", async () => {
    await inRollback(async (c) => {
      const { group, owner } = await setup(c);
      const luis = await other(c, "Luis");
      const member = await addMember(deps(c), owner.id, group.id, {
        displayName: "Luis",
        inviteeId: luis,
      });
      await c.query("update module_owe_no.owe_no_members set state = 'active' where id = $1", [
        member.id,
      ]);
      await blockMember(deps(c), owner.id, group.id, member.id);
      expect(await groupBalances(deps(c), group.id)).toBeTruthy();
      await expect(
        addMember(deps(c), owner.id, group.id, { displayName: "Luis", inviteeId: luis }),
      ).rejects.toMatchObject({ code: "conflict", details: { code: "member_blocked" } });
      await unblockMember(deps(c), owner.id, group.id, member.id);
      await expect(
        addMember(deps(c), owner.id, group.id, { displayName: "Luis", inviteeId: luis }),
      ).resolves.toMatchObject({ state: "invited" });
    });
  });
});

describe("owe-no active member (importer)", () => {
  it("adds a member as active when the creator imports history", async () => {
    await inRollback(async (c) => {
      const { group, owner } = await setup(c);
      const member = await addMember(deps(c), owner.id, group.id, {
        displayName: "Histórico",
        active: true,
      });
      expect(member.state).toBe("active");
    });
  });
});

describe("owe-no removal with a pending balance (D29)", () => {
  it("turns the account into a fictitious member when mode=ghost", async () => {
    await inRollback(async (c) => {
      const { group, owner } = await setup(c);
      const luis = await other(c, "Luis");
      const member = await addMember(deps(c), owner.id, group.id, {
        displayName: "Luis",
        inviteeId: luis,
        active: true,
      });
      const { rows: ownerMember } = await query(
        c,
        "select id from module_owe_no.owe_no_members where group_id = $1 and user_id = $2",
        [group.id, owner.id],
      );
      await c.query(
        `insert into module_owe_no.owe_no_movements
           (group_id, kind, description, amount_minor, currency, paid_by_member_id, occurred_on, created_by)
         values ($1, 'expense', 'Cena', 500, 'EUR', $2, current_date, $3)`,
        [group.id, ownerMember[0].id, owner.id],
      );
      await c.query(
        `insert into module_owe_no.owe_no_movement_shares (movement_id, member_id, amount_minor)
         select id, $2, 500 from module_owe_no.owe_no_movements where group_id = $1`,
        [group.id, member.id],
      );
      await removeMember(deps(c), owner.id, group.id, member.id, "ghost");
      const { rows } = await query(
        c,
        "select user_id, state from module_owe_no.owe_no_members where id = $1",
        [member.id],
      );
      expect(rows[0]).toMatchObject({ user_id: null, state: "active" });
    });
  });
});

describe("owe-no invitation decline", () => {
  it("marks the invitation as left and cannot be declined twice", async () => {
    await inRollback(async (c) => {
      const { group, owner } = await setup(c);
      const luis = await other(c, "Luis");
      const member = await addMember(deps(c), owner.id, group.id, {
        displayName: "Luis",
        inviteeId: luis,
      });
      await declineInvitation(deps(c), luis, group.id);
      const { rows } = await query(
        c,
        "select state from module_owe_no.owe_no_members where id = $1",
        [member.id],
      );
      expect(rows[0].state).toBe("left");
      await expect(declineInvitation(deps(c), luis, group.id)).rejects.toMatchObject({
        code: "conflict",
      });
    });
  });
});
