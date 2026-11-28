import { describe, expect, it } from "vitest";
import { query } from "../pg.js";
import { inRollback, installTodo } from "./todo-fixture.js";

/**
 * The hourly pass the Core dispatcher calls as the module, without a session.
 * It has to be safe to run twice: the second run finds nothing left to close.
 */
describe("todo hourly job", () => {
  it("expires requests, advances periods and closes the finished season", async () => {
    await inRollback(async (c) => {
      await installTodo(c);
      const { rows: user } = await query(
        c,
        `insert into auth.users (id, instance_id, email, encrypted_password, email_confirmed_at,
                                 raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
         values (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', $1, crypt('x', gen_salt('bf')),
                 now(), '{}'::jsonb, '{}'::jsonb, now(), now()) returning id`,
        [`job-${Date.now()}@test.local`],
      );
      const userId = String(user[0]!.id);
      await query(
        c,
        `insert into public.profiles (id, display_name, role) values ($1, 'Ana', 'user')`,
        [userId],
      );

      // A monthly group whose season opened two months ago, with points already won.
      const { rows: group } = await query(
        c,
        `insert into module_todo.todo_groups
           (name, kind, owner_id, timezone, power_enabled, power_period, season_number, season_started_on)
         values ('Casa', 'group', $1, 'Europe/Madrid', true, 'monthly', 1,
                 (current_date - interval '2 months')::date)
         returning id`,
        [userId],
      );
      const groupId = String(group[0]!.id);
      await query(
        c,
        `insert into module_todo.todo_group_members (group_id, user_id, role) values ($1, $2, 'owner')`,
        [groupId, userId],
      );
      await query(
        c,
        `insert into module_todo.todo_seasons (group_id, number, period, started_on)
         values ($1, 1, 'monthly', (current_date - interval '2 months')::date)`,
        [groupId],
      );
      await query(
        c,
        `insert into module_todo.todo_power_totals (group_id, user_id, season_number, points, tasks_done)
         values ($1, $2, 1, 7, 3)`,
        [groupId, userId],
      );

      // A weekly task stuck in a past period, and an expired request.
      const { rows: task } = await query(
        c,
        `insert into module_todo.todo_tasks
           (group_id, title, assignee_id, recurrence, keep_assignee, period_start, period_end, created_by)
         values ($1, 'Sacar la basura', $2, 'weekly', false,
                 (current_date - interval '10 days')::date, (current_date - interval '4 days')::date, $2)
         returning id`,
        [groupId, userId],
      );
      const taskId = String(task[0]!.id);
      await query(
        c,
        `insert into module_todo.todo_requests (group_id, task_id, requester_id, expires_at)
         values ($1, $2, $3, now() - interval '2 hours')`,
        [groupId, taskId, userId],
      );

      // The Core dispatcher runs the job with the module schema on the path.
      await c.query("set local search_path = module_todo, public");
      const { rows: first } = await query(c, "select job_hourly() as result");
      const result = first[0]?.result as { expired: number; advanced: number; closed: number };
      expect(result.expired).toBe(1);
      expect(result.advanced).toBeGreaterThanOrEqual(1);
      expect(result.closed).toBeGreaterThanOrEqual(1);

      // The request is closed, the task sits in the current period and the season is archived.
      const { rows: requests } = await query(
        c,
        "select state from module_todo.todo_requests where group_id = $1",
        [groupId],
      );
      expect(requests[0]?.state).toBe("expired");

      const { rows: taskRow } = await query(
        c,
        `select state, assignee_id, period_end >= current_date as current
           from module_todo.todo_tasks where id = $1`,
        [taskId],
      );
      expect(taskRow[0]?.state).toBe("pending");
      expect(taskRow[0]?.assignee_id).toBeNull();
      expect(taskRow[0]?.current).toBe(true);

      const { rows: season } = await query(
        c,
        `select closed_on is not null as closed from module_todo.todo_seasons
          where group_id = $1 and number = 1`,
        [groupId],
      );
      expect(season[0]?.closed).toBe(true);
      const { rows: results } = await query(
        c,
        `select points, tasks_done, position from module_todo.todo_season_results r
           join module_todo.todo_seasons s on s.id = r.season_id
          where s.group_id = $1 and s.number = 1`,
        [groupId],
      );
      expect(results).toEqual([{ points: 7, tasks_done: 3, position: 1 }]);

      const { rows: groupRow } = await query(
        c,
        "select season_number from module_todo.todo_groups where id = $1",
        [groupId],
      );
      expect(Number(groupRow[0]?.season_number)).toBeGreaterThanOrEqual(2);

      // Idempotent: a second run has nothing to close or advance.
      const { rows: second } = await query(c, "select job_hourly() as result");
      const again = second[0]?.result as { expired: number; advanced: number; closed: number };
      expect(again).toEqual({ expired: 0, advanced: 0, closed: 0 });
    });
  });
});
