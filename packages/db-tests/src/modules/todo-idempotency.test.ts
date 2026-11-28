import { describe, expect, it } from "vitest";
import { query } from "../pg.js";
import { inRollback, installTodo, session, todoDeps } from "./todo-fixture.js";
import { addMember, createGroup } from "@027apps/todo/domain/groups.js";
import { claimTask, completeTask, createTask, listTasks } from "@027apps/todo/domain/tasks.js";
import { listRequests, requestTask } from "@027apps/todo/domain/requests.js";
import { withIdempotency } from "@027apps/todo/domain/idempotency.js";

const TZ = "Europe/Madrid";

async function codeOf(fn: () => Promise<unknown>): Promise<string> {
  try {
    await fn();
    return "none";
  } catch (error) {
    return (error as { code?: string }).code ?? "unknown";
  }
}

describe("todo idempotency", () => {
  it("replays a create instead of writing the task twice", async () => {
    await inRollback(async (c) => {
      await installTodo(c);
      const deps = todoDeps(c);
      const ana = await session(c, "user");
      const me = { userId: ana.userId!, role: ana.role };
      const group = await createGroup(deps, me, { name: "Casa", timezone: TZ });

      const create = () =>
        withIdempotency(deps, me, { key: "create-1", endpoint: "POST tasks" }, (scoped) =>
          createTask(scoped, me, group.id, { title: "Sacar la basura" }),
        );

      const first = await create();
      const second = await create();
      expect(second.id).toBe(first.id);

      const page = await listTasks(deps, me, group.id, { state: "all" });
      expect(page.tasks.filter((task) => task.title === "Sacar la basura")).toHaveLength(1);

      // A different key is a different intent: it creates another task.
      const other = await withIdempotency(
        deps,
        me,
        { key: "create-2", endpoint: "POST tasks" },
        (scoped) => createTask(scoped, me, group.id, { title: "Sacar la basura" }),
      );
      expect(other.id).not.toBe(first.id);
    });
  });

  it("replays a completion without counting it twice", async () => {
    await inRollback(async (c) => {
      await installTodo(c);
      const deps = todoDeps(c);
      const ana = await session(c, "user");
      const me = { userId: ana.userId!, role: ana.role };
      const group = await createGroup(deps, me, {
        name: "Casa",
        timezone: TZ,
        powerEnabled: true,
        powerPeriod: "infinite",
      });
      const task = await createTask(deps, me, group.id, {
        title: "Sacar la basura",
        power: 4,
      });
      await claimTask(deps, me, task.id);

      const complete = () =>
        withIdempotency(deps, me, { key: "done-key-1", endpoint: "POST complete" }, (scoped) =>
          completeTask(scoped, me, task.id),
        );

      const first = await complete();
      // Without the key this would be `task_done`; a retry must answer the same.
      const second = await complete();
      expect(second.completedAt).toBe(first.completedAt);

      const { rows } = await query(
        c,
        "select points, tasks_done from module_todo.todo_power_totals where group_id = $1 and user_id = $2",
        [group.id, ana.userId],
      );
      expect(Number(rows[0]!.points)).toBe(4);
      expect(Number(rows[0]!.tasks_done)).toBe(1);
    });
  });

  it("replays a request and refuses a key reused for another endpoint", async () => {
    await inRollback(async (c) => {
      await installTodo(c);
      const deps = todoDeps(c);
      const ana = await session(c, "user");
      const luis = await session(c, "user");
      const me = { userId: ana.userId!, role: ana.role };
      const asLuis = { userId: luis.userId!, role: luis.role };
      const group = await createGroup(deps, me, { name: "Casa", timezone: TZ });
      await addMember(deps, me, group.id, luis.userId!);
      const task = await createTask(deps, me, group.id, {
        title: "Sacar la basura",
        assigneeId: ana.userId,
      });

      const ask = () =>
        withIdempotency(deps, asLuis, { key: "ask-key-1", endpoint: "POST request" }, (scoped) =>
          requestTask(scoped, asLuis, task.id),
        );

      const first = await ask();
      const second = await ask();
      expect(second.id).toBe(first.id);
      const outgoing = await listRequests(deps, asLuis, "outgoing");
      expect(outgoing).toHaveLength(1);

      expect(
        await codeOf(() =>
          withIdempotency(deps, asLuis, { key: "ask-key-1", endpoint: "POST tasks" }, (scoped) =>
            createTask(scoped, asLuis, group.id, { title: "Otra" }),
          ),
        ),
      ).toBe("validation_failed");

      for (const key of ["  ", "short"]) {
        expect(
          await codeOf(() =>
            withIdempotency(deps, asLuis, { key, endpoint: "POST request" }, (scoped) =>
              requestTask(scoped, asLuis, task.id),
            ),
          ),
        ).toBe("validation_failed");
      }
    });
  });
});
