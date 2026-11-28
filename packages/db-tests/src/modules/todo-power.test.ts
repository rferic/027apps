import { describe, expect, it } from "vitest";
import { query } from "../pg.js";
import { inRollback, installTodo, session, todoDeps } from "./todo-fixture.js";
import { addMember, createGroup, updateGroup } from "@027apps/todo/domain/groups.js";
import { completeTask, createTask, getTask } from "@027apps/todo/domain/tasks.js";
import { reopenTask } from "@027apps/todo/domain/requests.js";
import { closeFinishedSeasons, closeSeason, getSeason, listSeasons, powerBoard } from "@027apps/todo/domain/power.js";

const TZ = "Europe/Madrid";
const clock = () => new Date("2026-11-27T10:00:00Z");

describe("todo power", () => {
  it("counts points and tasks on completion, and gives them back on undo", async () => {
    await inRollback(async (c) => {
      await installTodo(c);
      const deps = todoDeps(c, clock);
      const ana = await session(c, "user");
      const luis = await session(c, "user");
      const me = { userId: ana.userId!, role: ana.role };
      const asLuis = { userId: luis.userId!, role: luis.role };
      const group = await createGroup(deps, me, {
        name: "Casa",
        timezone: TZ,
        powerEnabled: true,
        powerPeriod: "monthly",
      });
      await addMember(deps, me, group.id, luis.userId!);

      const task = await createTask(deps, me, group.id, {
        title: "Pintar la valla",
        power: 4,
        assigneeId: ana.userId,
      });
      await completeTask(deps, me, task.id);

      let board = await powerBoard(deps, me, group.id);
      expect(board.rows).toEqual([
        { userId: ana.userId, displayName: expect.any(String), points: 4, tasksDone: 1, position: 1 },
      ]);

      await reopenTask(deps, me, task.id);
      board = await powerBoard(deps, me, group.id);
      expect(board.rows[0]?.points).toBe(0);
      expect(board.rows[0]?.tasksDone).toBe(0);

      // Undo again cannot push the counter below zero.
      const other = await createTask(deps, me, group.id, {
        title: "Regar",
        power: 5,
        assigneeId: ana.userId,
      });
      await completeTask(deps, me, other.id);
      await reopenTask(deps, me, other.id);
      board = await powerBoard(deps, me, group.id);
      expect(board.rows[0]?.points).toBe(0);
    });
  });

  it("ranks with shared positions and archives the season on close", async () => {
    await inRollback(async (c) => {
      await installTodo(c);
      const deps = todoDeps(c, clock);
      const ana = await session(c, "user");
      const luis = await session(c, "user");
      const me = { userId: ana.userId!, role: ana.role };
      const asLuis = { userId: luis.userId!, role: luis.role };
      const group = await createGroup(deps, me, {
        name: "Casa",
        timezone: TZ,
        powerEnabled: true,
        powerPeriod: "monthly",
      });
      await addMember(deps, me, group.id, luis.userId!);

      for (const [owner, title, power] of [
        [me, "Uno", 5],
        [asLuis, "Dos", 5],
        [me, "Tres", 1],
      ] as const) {
        const task = await createTask(deps, owner, group.id, {
          title,
          power,
          assigneeId: owner.userId,
        });
        await completeTask(deps, owner, task.id);
      }

      const board = await powerBoard(deps, me, group.id);
      expect(board.rows.map((row) => [row.points, row.position])).toEqual([
        [6, 1],
        [5, 2],
      ]);

      const closed = await closeSeason(deps, me, group.id);
      expect(closed.seasonNumber).toBe(2);
      expect(closed.rows).toEqual([]);

      const archived = await getSeason(deps, me, group.id, 1);
      expect(archived.closedOn).toBe("2026-11-27");
      expect(archived.rows.map((row) => [row.points, row.position])).toEqual([
        [6, 1],
        [5, 2],
      ]);
      expect((await listSeasons(deps, me, group.id)).map((s) => s.number)).toEqual([2, 1]);
    });
  });

  it("closes a finished period on its own once the period is over", async () => {
    await inRollback(async (c) => {
      await installTodo(c);
      const deps = todoDeps(c, () => new Date("2026-12-03T10:00:00Z"));
      const ana = await session(c, "user");
      const me = { userId: ana.userId!, role: ana.role };
      const group = await createGroup(deps, me, {
        name: "Casa",
        timezone: TZ,
        powerEnabled: true,
        powerPeriod: "monthly",
      });

      // The season started in November; December has begun.
      await query(
        c,
        `update module_todo.todo_groups set season_started_on = '2026-11-01' where id = $1`,
        [group.id],
      );
      const task = await createTask(deps, me, group.id, {
        title: "Pagar la comunidad",
        power: 3,
        assigneeId: ana.userId,
      });
      await completeTask(deps, me, task.id);

      expect(await closeFinishedSeasons(deps)).toBe(1);
      const archived = await getSeason(deps, me, group.id, 1);
      expect(archived.rows[0]?.points).toBe(3);

      // Running it again the same day changes nothing.
      expect(await closeFinishedSeasons(deps)).toBe(0);
    });
  });

  it("refuses the board when the group has no power", async () => {
    await inRollback(async (c) => {
      await installTodo(c);
      const deps = todoDeps(c, clock);
      const ana = await session(c, "user");
      const me = { userId: ana.userId!, role: ana.role };
      const group = await createGroup(deps, me, { name: "Casa", timezone: TZ });
      await expect(powerBoard(deps, me, group.id)).rejects.toMatchObject({ code: "power_disabled" });

      // Turning it on keeps the group usable; a personal folder never can.
      await updateGroup(deps, me, group.id, { powerEnabled: true, powerPeriod: "weekly" });
      expect((await powerBoard(deps, me, group.id)).seasonNumber).toBe(1);
      const task = await createTask(deps, me, group.id, {
        title: "Una",
        assigneeId: ana.userId,
      });
      expect((await getTask(deps, me, task.id)).power).toBeNull();
    });
  });
});
