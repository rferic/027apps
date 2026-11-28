import { describe, expect, it } from "vitest";
import { query } from "../pg.js";
import { inRollback, installTodo, session, todoDeps } from "./todo-fixture.js";
import { addMember, createGroup } from "@027apps/todo/domain/groups.js";
import { claimTask, completeTask, createTask, releaseTask } from "@027apps/todo/domain/tasks.js";
import { acceptRequest, requestTask } from "@027apps/todo/domain/requests.js";
import { closeSeason } from "@027apps/todo/domain/power.js";

const TZ = "Europe/Madrid";
const clock = () => new Date("2026-11-27T10:00:00Z");

async function outbox(c: Parameters<typeof query>[0]) {
  const { rows } = await query(
    c,
    `select type, target, subject_id, notify, resource
       from public.event_outbox
      where module_key = 'todo'
      order by created_at, type`,
  );
  return rows.map((row) => ({
    type: String(row.type),
    target: String(row.target),
    subject: row.subject_id === null ? null : String(row.subject_id),
    notify: row.notify as string[] | null,
    actor: String((row.resource as { actor_id?: string }).actor_id ?? ""),
  }));
}

describe("todo events", () => {
  it("emits the ten outbox events with the right target and the actor inside", async () => {
    await inRollback(async (c) => {
      await installTodo(c);
      const deps = todoDeps(c, clock);
      const ana = await session(c, "user");
      const luis = await session(c, "user");
      const me = { userId: ana.userId!, role: ana.role };
      const asLuis = { userId: luis.userId!, role: luis.role };
      const group = await createGroup(deps, me, { name: "Casa", timezone: TZ });
      await addMember(deps, me, group.id, luis.userId!);
      const channel = `channel:todo-group-${group.id}`;

      // Free: the group hears about it.
      await createTask(deps, me, group.id, { title: "Comprar detergente" });
      // Assigned to somebody else: only that person does.
      await createTask(deps, me, group.id, { title: "Pintar la valla", assigneeId: luis.userId });
      // Assigned to the actor: nobody is told.
      await createTask(deps, me, group.id, { title: "Mi tarea", assigneeId: ana.userId });

      const held = await createTask(deps, me, group.id, {
        title: "Sacar la basura",
        assigneeId: ana.userId,
      });
      await releaseTask(deps, me, held.id);
      await claimTask(deps, asLuis, held.id);
      await completeTask(deps, asLuis, held.id);

      // A different task, still held: asking for it is a request.
      const asked = await createTask(deps, me, group.id, {
        title: "Regar las plantas",
        assigneeId: ana.userId,
      });
      const request = await requestTask(deps, asLuis, asked.id);
      expect(request.state).toBe("pending");

      let rows = await outbox(c);
      expect(rows.filter((row) => row.type === "todo.task_created")).toEqual([
        { type: "todo.task_created", target: channel, subject: null, notify: ["push"], actor: ana.userId },
      ]);
      expect(rows.filter((row) => row.type === "todo.task_created_assigned")).toEqual([
        {
          type: "todo.task_created_assigned",
          target: "user",
          subject: luis.userId,
          notify: ["push"],
          actor: ana.userId,
        },
      ]);
      expect(rows.filter((row) => row.type === "todo.task_released").map((row) => row.actor)).toEqual([
        ana.userId,
      ]);
      expect(rows.filter((row) => row.type === "todo.task_completed")).toEqual([
        expect.objectContaining({ target: channel, actor: luis.userId }),
      ]);
      expect(rows.filter((row) => row.type === "todo.request_created")).toEqual([
        {
          type: "todo.request_created",
          target: "user",
          subject: ana.userId, // the holder is told
          notify: ["push"],
          actor: luis.userId, // the requester asked
        },
      ]);
      // Completion did not emit the season: the group has no power yet.
      expect(rows.some((row) => row.type === "todo.season_closed")).toBe(false);

      // The holder accepts: the requester is told and gets the task.
      await acceptRequest(deps, me, request.id);
      rows = await outbox(c);
      expect(rows.filter((row) => row.type === "todo.request_resolved")).toEqual([
        {
          type: "todo.request_resolved",
          target: "user",
          subject: luis.userId, // the requester hears the answer
          notify: ["push"],
          actor: ana.userId, // the holder answered
        },
      ]);
      expect(rows.filter((row) => row.type === "todo.task_assigned").map((row) => row.subject)).toEqual([
        luis.userId,
      ]);
    });
  });

  it("announces the season close to the group", async () => {
    await inRollback(async (c) => {
      await installTodo(c);
      const deps = todoDeps(c, clock);
      const ana = await session(c, "user");
      const me = { userId: ana.userId!, role: ana.role };
      const group = await createGroup(deps, me, {
        name: "Casa",
        timezone: TZ,
        powerEnabled: true,
        powerPeriod: "monthly",
      });
      await closeSeason(deps, me, group.id);
      const rows = (await outbox(c)).filter((row) => row.type === "todo.season_closed");
      expect(rows).toEqual([
        {
          type: "todo.season_closed",
          target: `channel:todo-group-${group.id}`,
          subject: null,
          notify: ["push"],
          actor: ana.userId,
        },
      ]);
    });
  });
});
