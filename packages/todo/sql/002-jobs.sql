-- 1.1.0 — the hourly maintenance pass.
--
-- Runs without a user, as the Core dispatcher calls it, with the module schema on
-- the search path. Three duties, all idempotent: expiring requests, closing the
-- period of periodic tasks and closing a finished season.
--
-- The season of a completion is the one that was open when it happened, so this
-- function never touches a closed season's stored results.

create function job_hourly() returns jsonb
language plpgsql
as $$
declare
  r record;
  n_expired int := 0;
  n_advanced int := 0;
  n_closed int := 0;
  today date;
  next_start date;
  next_end date;
  season_end date;
  closed_id uuid;
  cur_number int;
  cur_start date;
  next_period_start date;
begin
  -- 1. A request past its deadline closes itself, with no notification.
  update todo_requests
     set state = 'expired', resolved_at = now()
   where state = 'pending' and expires_at <= now();
  get diagnostics n_expired = row_count;

  -- 2. Periodic tasks: record the missed periods and open the current one.
  for r in
    select t.id, t.group_id, t.state, t.assignee_id, t.keep_assignee, t.recurrence,
           t.period_start, t.period_end, g.timezone
      from todo_tasks t
      join todo_groups g on g.id = t.group_id
     where t.recurrence <> 'none'
  loop
    today := (now() at time zone r.timezone)::date;
    while r.period_end < today loop
      if r.state = 'pending' then
        -- The installer's SQL guard forbids the word that starts an `ON CONFLICT`
        -- clause, so the row is guarded by hand instead.
        insert into todo_task_occurrences (group_id, task_id, period_start, period_end, outcome)
        select r.group_id, r.id, r.period_start, r.period_end, 'missed'
         where not exists (
           select 1 from todo_task_occurrences o
            where o.task_id = r.id and o.period_start = r.period_start
         );
      end if;
      next_start := r.period_end + 1;
      if r.recurrence = 'weekly' then
        next_end := next_start + 6;
      elsif r.recurrence = 'monthly' then
        next_end := (date_trunc('month', next_start::timestamptz) + interval '1 month')::date - 1;
      else
        next_end := (date_trunc('year', next_start::timestamptz) + interval '1 year')::date - 1;
      end if;
      update todo_tasks
         set state = 'pending', completed_at = null, completed_by = null,
             period_start = next_start, period_end = next_end,
             assignee_id = case when r.keep_assignee then r.assignee_id else null end,
             updated_at = now()
       where id = r.id;
      r.period_start := next_start;
      r.period_end := next_end;
      r.state := 'pending';
      n_advanced := n_advanced + 1;
    end loop;
  end loop;

  -- 3. Seasons whose period finished: archive the ranking and open the next one.
  --    A group that has been idle for months catches up in a single pass.
  for r in
    select id, timezone, power_period, season_number, season_started_on
      from todo_groups
     where power_enabled and power_period <> 'infinite'
  loop
    today := (now() at time zone r.timezone)::date;
    cur_number := r.season_number;
    cur_start := r.season_started_on;
    loop
      if r.power_period = 'weekly' then
        season_end := date_trunc('week', cur_start::timestamptz)::date + 6;
      elsif r.power_period = 'monthly' then
        season_end := (date_trunc('month', cur_start::timestamptz) + interval '1 month')::date - 1;
      else
        season_end := (date_trunc('year', cur_start::timestamptz) + interval '1 year')::date - 1;
      end if;
      exit when season_end >= today;

      update todo_seasons
         set closed_on = season_end
       where group_id = r.id and number = cur_number and closed_on is null
       returning id into closed_id;

      if closed_id is null then
        insert into todo_seasons (group_id, number, period, started_on, closed_on)
        values (r.id, cur_number, r.power_period, cur_start, season_end)
        returning id into closed_id;
      end if;

      insert into todo_season_results (season_id, user_id, points, tasks_done, position)
      select closed_id, t.user_id, t.points, t.tasks_done,
             rank() over (order by t.points desc, t.tasks_done desc)
        from todo_power_totals t
       where t.group_id = r.id and t.season_number = cur_number;

      if r.power_period = 'weekly' then
        next_period_start := season_end + 1;
      elsif r.power_period = 'monthly' then
        next_period_start := (date_trunc('month', (season_end + 1)::timestamptz))::date;
      else
        next_period_start := (date_trunc('year', (season_end + 1)::timestamptz))::date;
      end if;

      update todo_groups
         set season_number = cur_number + 1,
             season_started_on = next_period_start,
             updated_at = now()
       where id = r.id;

      insert into todo_seasons (group_id, number, period, started_on)
      select r.id, cur_number + 1, r.power_period, next_period_start
       where not exists (
         select 1 from todo_seasons s
          where s.group_id = r.id and s.number = cur_number + 1
       );

      cur_number := cur_number + 1;
      cur_start := next_period_start;
      n_closed := n_closed + 1;
    end loop;
  end loop;

  return jsonb_build_object('expired', n_expired, 'advanced', n_advanced, 'closed', n_closed);
end
$$;
