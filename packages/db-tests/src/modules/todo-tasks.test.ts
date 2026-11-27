import { describe, expect, it } from "vitest";
import { query } from "../pg.js";
import { inRollback, installTodo, session, todoDeps } from "./todo-fixture.js";
import { addMember, createGroup } from "@027apps/todo/domain/groups.js";
import {
  advancePeriod,
  claimTask,
  completeTask,
  createTask,
  deleteTask,
  getTask,
  listTasks,
  releaseTask,
  updateTask,
} from "@027apps/todo/domain/tasks.js";

const TZ = "Europe/Madrid";
const clock = () => new Date("2026-11-27T10:00:00Z");

async function codeOf(fn: () => Promise<unknown>): Promise<string> {
  try {
    await fn();
    return "none";
  } catch (error) {
    return (error as { code?: string }).code ?? "unknown";
  }
}

describe("todo tasks", () => {
  it("belongs to the group while free and to its holder once taken", async () => {
    await inRollback(async (c) => {
      await installTodo(c);
      const deps = todoDeps(c, clock);
      const ana = await session(c, "user");
      const luis = await session(c, "user");
      const me = { userId: ana.userId!, role: ana.role };
      const asLuis = { userId: luis.userId!, role: luis.role };

      const group = await createGroup(deps, me, { name: "🏠 Casa", timezone: TZ });
      await addMember(deps, me, group.id, luis.userId!);

      const task = await createTask(deps, me, group.id, { title: "🧴 Comprar detergente" });
      expect(task.title).toBe("🧴 Comprar detergente");
      expect(task.assigneeId).toBeNull();

      // Free: Luis edits it and takes it.
      const edited = await updateTask(deps, asLuis, task.id, { notes: "El del lavavajillas" });
      expect(edited.notes).toBe("El del lavavajillas");
      const taken = await claimTask(deps, asLuis, task.id);
      expect(taken.assigneeId).toBe(luis.userId);

      // Once held, Ana cannot edit, complete or delete it.
      expect(await codeOf(() => updateTask(deps, me, task.id, { title: "Otra" }))).toBe("forbidden");
      expect(await codeOf(() => completeTask(deps, me, task.id))).toBe("forbidden");
      expect(await codeOf(() => deleteTask(deps, me, task.id))).toBe("forbidden");

      // Only the holder completes, and a done task is not deleted.
      const done = await completeTask(deps, asLuis, task.id);
      expect(done.state).toBe("done");
      expect(await codeOf(() => deleteTask(deps, asLuis, task.id))).toBe("task_done");

      const { rows: occurrences } = await query(
        c,
        `select outcome, completed_by from module_todo.todo_task_occurrences where task_id = $1`,
        [task.id],
      );
      expect(occurrences).toEqual([{ outcome: "done", completed_by: luis.userId }]);
    });
  });

  it("lets two members race for a free task and only one win", async () => {
    await inRollback(async (c) => {
      await installTodo(c);
      const deps = todoDeps(c, clock);
      const ana = await session(c, "user");
      const luis = await session(c, "user");
      const me = { userId: ana.userId!, role: ana.role };
      const asLuis = { userId: luis.userId!, role: luis.role };
      const group = await createGroup(deps, me, { name: "Casa", timezone: TZ });
      await addMember(deps, me, group.id, luis.userId!);
      const task = await createTask(deps, me, group.id, { title: "Sacar la basura" });

      await claimTask(deps, me, task.id);
      expect(await codeOf(() => claimTask(deps, asLuis, task.id))).toBe("already_assigned");

      // The holder hands it back and it is free again for the group.
      const released = await releaseTask(deps, me, task.id);
      expect(released.assigneeId).toBeNull();
      expect((await claimTask(deps, asLuis, task.id)).assigneeId).toBe(luis.userId);
    });
  });

  it("filters by state, holder and overdue date", async () => {
    await inRollback(async (c) => {
      await installTodo(c);
      const deps = todoDeps(c, clock);
      const ana = await session(c, "user");
      const me = { userId: ana.userId!, role: ana.role };
      const group = await createGroup(deps, me, { name: "Casa", timezone: TZ });

      await createTask(deps, me, group.id, { title: "Sin fecha" });
      await createTask(deps, me, group.id, { title: "Vencida", dueOn: "2026-11-20" });
      const mine = await createTask(deps, me, group.id, {
        title: "Mía",
        assigneeId: ana.userId,
        dueOn: "2026-12-01",
      });

      const overdue = await listTasks(deps, me, group.id, { overdue: true });
      expect(overdue.tasks.map((task) => task.title)).toEqual(["Vencida"]);

      const own = await listTasks(deps, me, group.id, { mine: true });
      expect(own.tasks.map((task) => task.id)).toEqual([mine.id]);

      const page = await listTasks(deps, me, group.id, { limit: 2 });
      expect(page.tasks).toHaveLength(2);
      expect(page.nextCursor).not.toBeNull();
      const second = await listTasks(deps, me, group.id, { limit: 2, cursor: page.nextCursor! });
      expect(second.tasks).toHaveLength(1);
    });
  });

  it("closes a periodic task: records the miss, resets it and frees it", async () => {
    await inRollback(async (c) => {
      await installTodo(c);
      // Created inside the week of 2026-11-23; advanced from after it.
      const deps = todoDeps(c, () => new Date("2026-11-27T10:00:00Z"));
      const later = todoDeps(c, () => new Date("2026-12-02T10:00:00Z"));
      const ana = await session(c, "user");
      const me = { userId: ana.userId!, role: ana.role };
      const group = await createGroup(deps, me, { name: "Casa", timezone: TZ });

      const task = await createTask(deps, me, group.id, {
        title: "🗑️ Sacar la basura",
        recurrence: "weekly",
        assigneeId: ana.userId,
        keepAssignee: false,
      });
      expect(task.periodStart).toBe("2026-11-23");
      expect(task.periodEnd).toBe("2026-11-29");

      const { advanced } = await advancePeriod(later, task.id);
      expect(advanced).toBe(true);

      const after = await getTask(deps, me, task.id);
      expect(after.state).toBe("pending");
      expect(after.assigneeId).toBeNull();
      expect(after.periodStart).toBe("2026-11-30");

      const { rows: occurrences } = await query(
        c,
        `select period_start, outcome from module_todo.todo_task_occurrences where task_id = $1`,
        [task.id],
      );
      expect(occurrences).toEqual([{ period_start: expect.any(Date), outcome: "missed" }]);

      // Running it again for the same task is a no-op: the period is fresh.
      expect((await advancePeriod(later, task.id)).advanced).toBe(false);
    });
  });

  it("keeps the holder across periods when the task was created that way", async () => {
    await inRollback(async (c) => {
      await installTodo(c);
      const deps = todoDeps(c, () => new Date("2026-11-27T10:00:00Z"));
      const later = todoDeps(c, () => new Date("2026-12-02T10:00:00Z"));
      const ana = await session(c, "user");
      const me = { userId: ana.userId!, role: ana.role };
      const group = await createGroup(deps, me, { name: "Casa", timezone: TZ });

      const task = await createTask(deps, me, group.id, {
        title: "Regar las plantas",
        recurrence: "weekly",
        assigneeId: ana.userId,
        keepAssignee: true,
      });
      await advancePeriod(later, task.id);
      const after = await getTask(deps, me, task.id);
      expect(after.assigneeId).toBe(ana.userId);
    });
  });
});
