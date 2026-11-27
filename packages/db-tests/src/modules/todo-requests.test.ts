import { describe, expect, it } from "vitest";
import { query } from "../pg.js";
import { inRollback, installTodo, session, todoDeps } from "./todo-fixture.js";
import { addMember, createGroup } from "@027apps/todo/domain/groups.js";
import { claimTask, completeTask, createTask, getTask } from "@027apps/todo/domain/tasks.js";
import {
  acceptRequest,
  denyRequest,
  expireRequests,
  listRequests,
  reopenTask,
  requestTask,
} from "@027apps/todo/domain/requests.js";

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

describe("todo requests", () => {
  it("asks the holder, who accepts and hands the task over", async () => {
    await inRollback(async (c) => {
      await installTodo(c);
      const deps = todoDeps(c, clock);
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

      const request = await requestTask(deps, asLuis, task.id);
      expect(request.state).toBe("pending");
      const hours = (new Date(request.expiresAt).getTime() - Date.now()) / 3_600_000;
      expect(hours).toBeGreaterThan(23);
      expect(hours).toBeLessThan(25);

      // Only one open request per task, and the holder is the one who answers.
      expect(await codeOf(() => requestTask(deps, me, task.id))).toMatch(/(already_assigned|request_exists)/);
      expect(await codeOf(() => acceptRequest(deps, asLuis, request.id))).toBe("not_assignee");

      const accepted = await acceptRequest(deps, me, request.id);
      expect(accepted.state).toBe("accepted");
      expect((await getTask(deps, me, task.id)).assigneeId).toBe(luis.userId);

      // Answering twice is not possible.
      expect(await codeOf(() => acceptRequest(deps, me, request.id))).toBe("request_expired");

      const outgoing = await listRequests(deps, asLuis, "outgoing");
      expect(outgoing.map((row) => row.id)).toContain(request.id);
    });
  });

  it("denies without moving the task and expires on its own", async () => {
    await inRollback(async (c) => {
      await installTodo(c);
      const deps = todoDeps(c, clock);
      const ana = await session(c, "user");
      const luis = await session(c, "user");
      const me = { userId: ana.userId!, role: ana.role };
      const asLuis = { userId: luis.userId!, role: luis.role };
      const group = await createGroup(deps, me, { name: "Casa", timezone: TZ });
      await addMember(deps, me, group.id, luis.userId!);

      const first = await createTask(deps, me, group.id, {
        title: "Regar las plantas",
        assigneeId: ana.userId,
      });
      const request = await requestTask(deps, asLuis, first.id);
      expect((await denyRequest(deps, me, request.id)).state).toBe("denied");
      expect((await getTask(deps, me, first.id)).assigneeId).toBe(ana.userId);

      const second = await createTask(deps, me, group.id, {
        title: "Pintar la valla",
        assigneeId: ana.userId,
      });
      const stale = await requestTask(deps, asLuis, second.id);
      await query(
        c,
        `update module_todo.todo_requests set expires_at = '2026-11-20T10:00:00Z' where id = $1`,
        [stale.id],
      );
      expect(await expireRequests(deps)).toBe(1);
      expect(await codeOf(() => acceptRequest(deps, me, stale.id))).toBe("request_expired");
    });
  });

  it("undoes a completion, but never one from a closed season", async () => {
    await inRollback(async (c) => {
      await installTodo(c);
      const deps = todoDeps(c, clock);
      const ana = await session(c, "user");
      const me = { userId: ana.userId!, role: ana.role };
      const group = await createGroup(deps, me, { name: "Casa", timezone: TZ });

      const task = await createTask(deps, me, group.id, {
        title: "Pagar la comunidad",
        recurrence: "monthly",
        assigneeId: ana.userId,
      });
      await completeTask(deps, me, task.id);
      expect((await reopenTask(deps, me, task.id)).state).toBe("pending");
      expect((await getTask(deps, me, task.id)).state).toBe("pending");

      // Complete again and pretend the season has already closed.
      const again = await createTask(deps, me, group.id, {
        title: "Pagar la luz",
        assigneeId: ana.userId,
      });
      await completeTask(deps, me, again.id);
      const { rows: groupRow } = await query(
        c,
        "select season_started_on::text as started from module_todo.todo_groups where id = $1",
        [group.id],
      );
      expect(groupRow[0]?.started).toBeTruthy();
      await query(
        c,
        `update module_todo.todo_groups
            set power_enabled = true, power_period = 'monthly',
                season_number = 2, season_started_on = '2026-12-01'
          where id = $1`,
        [group.id],
      );
      expect(await codeOf(() => reopenTask(deps, me, again.id))).toBe("season_closed");
    });
  });
});
