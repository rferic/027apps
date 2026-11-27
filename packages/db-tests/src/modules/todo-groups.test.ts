import { describe, expect, it } from "vitest";
import { query } from "../pg.js";
import { inRollback, installTodo, session, todoDeps } from "./todo-fixture.js";
import {
  addMember,
  createGroup,
  deleteGroup,
  ensurePersonalGroup,
  getGroup,
  listGroups,
  listMembers,
  removeMember,
  updateGroup,
} from "@027apps/todo/domain/groups.js";

/** The stable error code of a rejected use case. */
async function codeOf(fn: () => Promise<unknown>): Promise<string> {
  try {
    await fn();
    return "none";
  } catch (error) {
    return (error as { code?: string }).code ?? "unknown";
  }
}

const TZ = "Europe/Madrid";

describe("todo groups", () => {
  it("gives every user one personal folder, with no members and no power", async () => {
    await inRollback(async (c) => {
      await installTodo(c);
      const deps = todoDeps(c);
      const ana = await session(c, "user");
      const me = { userId: ana.userId!, role: ana.role };

      const first = await ensurePersonalGroup(deps, me, { name: "🗂️ Mi carpeta", timezone: TZ });
      const again = await ensurePersonalGroup(deps, me, { name: "🗂️ Mi carpeta", timezone: TZ });
      expect(again.id).toBe(first.id);
      expect(first.kind).toBe("personal");
      expect(first.powerEnabled).toBe(false);

      const members = await listMembers(deps, me, first.id);
      expect(members).toHaveLength(1);
      expect(members[0]?.role).toBe("owner");

      const luis = await session(c, "user");
      const other = { userId: luis.userId!, role: luis.role };
      expect(await codeOf(() => addMember(deps, me, first.id, luis.userId!))).toBe("personal_group");
      expect(await codeOf(() => deleteGroup(deps, me, first.id))).toBe("personal_group");
      expect(await codeOf(() => updateGroup(deps, me, first.id, { powerEnabled: true }))).toBe(
        "personal_group",
      );
      // A stranger cannot even see it.
      expect(await codeOf(() => getGroup(deps, other, first.id))).toBe("not_found");
    });
  });

  it("creates a group with its owner, opens a season and lists it", async () => {
    await inRollback(async (c) => {
      await installTodo(c);
      const deps = todoDeps(c);
      const ana = await session(c, "user");
      const me = { userId: ana.userId!, role: ana.role };

      const group = await createGroup(deps, me, {
        name: "🏠 Casa",
        timezone: TZ,
        powerEnabled: true,
        powerPeriod: "monthly",
      });
      expect(group.kind).toBe("group");
      expect(group.name).toBe("🏠 Casa");
      expect(group.powerEnabled).toBe(true);

      const { rows: seasons } = await query(
        c,
        "select number, period, started_on from module_todo.todo_seasons where group_id = $1",
        [group.id],
      );
      expect(seasons).toEqual([
        { number: 1, period: "monthly", started_on: expect.any(Date) },
      ]);

      const listed = await listGroups(deps, me);
      expect(listed.map((row) => row.id)).toContain(group.id);
      expect(listed.find((row) => row.id === group.id)?.memberCount).toBe(1);
    });
  });

  it("lets the owner add and remove members, and frees their tasks on the way out", async () => {
    await inRollback(async (c) => {
      await installTodo(c);
      const deps = todoDeps(c);
      const ana = await session(c, "user");
      const luis = await session(c, "user");
      const me = { userId: ana.userId!, role: ana.role };
      const asLuis = { userId: luis.userId!, role: luis.role };

      const group = await createGroup(deps, me, { name: "Casa", timezone: TZ });
      const members = await addMember(deps, me, group.id, luis.userId!);
      expect(members.map((member) => member.userId).sort()).toEqual(
        [ana.userId!, luis.userId!].sort(),
      );

      // A plain member reads the group and nothing else.
      expect((await getGroup(deps, asLuis, group.id)).id).toBe(group.id);
      expect(await codeOf(() => updateGroup(deps, asLuis, group.id, { name: "Otra" }))).toBe(
        "forbidden",
      );
      expect(await codeOf(() => addMember(deps, asLuis, group.id, ana.userId!))).toBe("forbidden");

      // Luis holds a task and has asked for another one.
      const { rows: tasks } = await query(
        c,
        `insert into module_todo.todo_tasks (group_id, title, assignee_id, created_by)
         values ($1, '🧴 Comprar detergente', $2, $2) returning id`,
        [group.id, luis.userId],
      );
      const { rows: others } = await query(
        c,
        `insert into module_todo.todo_tasks (group_id, title, assignee_id, created_by)
         values ($1, '🗑️ Sacar la basura', $2, $2) returning id`,
        [group.id, ana.userId],
      );
      await query(
        c,
        `insert into module_todo.todo_requests (group_id, task_id, requester_id, expires_at)
         values ($1, $2, $3, now() + interval '24 hours')`,
        [group.id, others[0]!.id, luis.userId],
      );

      const after = await removeMember(deps, me, group.id, luis.userId!);
      expect(after.map((member) => member.userId)).toEqual([ana.userId!]);

      const { rows: freed } = await query(
        c,
        "select assignee_id from module_todo.todo_tasks where id = $1",
        [tasks[0]!.id],
      );
      expect(freed[0]?.assignee_id).toBeNull();

      const { rows: requests } = await query(
        c,
        "select state from module_todo.todo_requests where group_id = $1",
        [group.id],
      );
      expect(requests[0]?.state).toBe("expired");

      // The owner cannot leave.
      expect(await codeOf(() => removeMember(deps, me, group.id, ana.userId!))).toBe("last_owner");
    });
  });

  it("hides a group from anyone who is not a member", async () => {
    await inRollback(async (c) => {
      await installTodo(c);
      const deps = todoDeps(c);
      const ana = await session(c, "user");
      const luis = await session(c, "user");
      const group = await createGroup(deps, { userId: ana.userId!, role: ana.role }, {
        name: "Privado",
        timezone: TZ,
      });

      expect(
        await codeOf(() => getGroup(deps, { userId: luis.userId!, role: luis.role }, group.id)),
      ).toBe("not_found");
      expect(await codeOf(() => deleteGroup(deps, { userId: luis.userId!, role: luis.role }, group.id))).toBe(
        "not_found",
      );
    });
  });
});
