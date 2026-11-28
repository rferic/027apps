import type { Caller } from "./groups.js";
import { requireMember, requireOwner } from "./groups.js";
import { TodoDomainError } from "./errors.js";
import { nextPeriod, periodEnded, periodFor, localDate, type Recurrence } from "./recurrence.js";
import type { TodoDeps } from "./types.js";

/**
 * Power and seasons (spec §5.5).
 *
 * The counter is one row per member and season; the results page is a copy taken
 * when the season closes. There is no per-point ledger on purpose (D15): cleaning
 * up tasks must never be able to unbalance a closed season, and the archived copy
 * is what the family compares.
 */

export type SeasonPeriod = "infinite" | "weekly" | "monthly" | "yearly";

export interface PowerRow {
  userId: string | null;
  displayName: string;
  points: number;
  tasksDone: number;
  position: number;
}

export interface Board {
  seasonNumber: number;
  period: SeasonPeriod;
  startedOn: string;
  rows: PowerRow[];
}

/** Ranks in SQL so ties share a position (1, 1, 3) and name breaks nothing. */
const BOARD_SQL = `
  select t.user_id, coalesce(p.display_name, '') as display_name, t.points, t.tasks_done,
         rank() over (order by t.points desc, t.tasks_done desc) as position
    from module_todo.todo_power_totals t
    left join public.profiles p on p.id = t.user_id
   where t.group_id = $1 and t.season_number = $2

`;

export async function powerBoard(
  deps: TodoDeps,
  caller: Caller,
  groupId: string,
): Promise<Board> {
  const group = await requireMember(deps, caller.userId, groupId);
  if (!group.powerEnabled) throw new TodoDomainError("power_disabled", "this group has no power");
  const { rows } = await deps.db.query(`${BOARD_SQL} order by position, t.points desc`, [
    groupId,
    group.seasonNumber,
  ]);
  return {
    seasonNumber: group.seasonNumber,
    period: group.powerPeriod,
    startedOn: group.seasonStartedOn,
    rows: rows.map((row) => ({
      userId: row.user_id === null ? null : String(row.user_id),
      displayName: String(row.display_name),
      points: Number(row.points),
      tasksDone: Number(row.tasks_done),
      position: Number(row.position),
    })),
  };
}

// `power` may be null: a task without a value still counts as one task done.
export async function award(
  deps: TodoDeps,
  groupId: string,
  userId: string,
  seasonNumber: number,
  power: number | null,
): Promise<void> {
  await deps.db.query(
    `insert into module_todo.todo_power_totals
       (group_id, user_id, season_number, points, tasks_done)
     values ($1, $2, $3, $4, 1)
     on conflict (group_id, user_id, season_number) do update
       set points = module_todo.todo_power_totals.points + excluded.points,
           tasks_done = module_todo.todo_power_totals.tasks_done + 1,
           updated_at = now()`,
    [groupId, userId, seasonNumber, power ?? 0],
  );
}

/** Undo gives the points back, never below zero (D13). */
export async function refund(
  deps: TodoDeps,
  groupId: string,
  userId: string,
  seasonNumber: number,
  power: number | null,
): Promise<void> {
  await deps.db.query(
    `update module_todo.todo_power_totals
        set points = greatest(0, points - $4),
            tasks_done = greatest(0, tasks_done - 1),
            updated_at = now()
      where group_id = $1 and user_id = $2 and season_number = $3`,
    [groupId, userId, seasonNumber, power ?? 0],
  );
}

async function archive(
  deps: TodoDeps,
  groupId: string,
  season: { number: number; period: SeasonPeriod; startedOn: string },
  closedOn: string,
  closedBy: string | null,
): Promise<void> {
  // The season row is opened with the group; closing stamps it. A group created
  // before the row existed gets one here.
  const { rows: closed } = await deps.db.query(
    `update module_todo.todo_seasons
        set closed_on = $3, closed_by = $4
      where group_id = $1 and number = $2 and closed_on is null
      returning id`,
    [groupId, season.number, closedOn, closedBy],
  );
  const { rows: seasonRow } = closed[0]
    ? { rows: closed }
    : await deps.db.query(
        `insert into module_todo.todo_seasons (group_id, number, period, started_on, closed_on, closed_by)
         values ($1, $2, $3, $4, $5, $6)
         returning id`,
        [groupId, season.number, season.period, season.startedOn, closedOn, closedBy],
      );
  const seasonId = String(seasonRow[0]!.id);
  await deps.db.query(
    `insert into module_todo.todo_season_results (season_id, user_id, points, tasks_done, position)
     select $1, t.user_id, t.points, t.tasks_done,
            rank() over (order by t.points desc, t.tasks_done desc)
       from module_todo.todo_power_totals t
      where t.group_id = $2 and t.season_number = $3`,
    [seasonId, groupId, season.number],
  );
}

/**
 * Closes the open season: archives the ranking, opens the next one and starts the
 * counter from zero. `caller` is null when the hourly job closes a finished one.
 */
export async function closeSeason(
  deps: TodoDeps,
  caller: Caller | null,
  groupId: string,
): Promise<Board> {
  const target = caller
    ? await requireOwner(deps, caller.userId, groupId)
    : await loadGroup(deps, groupId);
  if (!target.powerEnabled) throw new TodoDomainError("power_disabled", "this group has no power");

  const now = deps.now?.() ?? new Date();
  const today = localDate(now, target.timezone);
  const season = {
    number: target.seasonNumber,
    period: target.powerPeriod,
    startedOn: target.seasonStartedOn,
  };
  await archive(deps, groupId, season, today, caller?.userId ?? null);

  const nextStart =
    target.powerPeriod === "infinite"
      ? today
      : nextPeriod(target.powerPeriod as Recurrence, periodFor(target.powerPeriod as Recurrence, today).end).start;
  await deps.db.query(
    `update module_todo.todo_groups
        set season_number = season_number + 1, season_started_on = $2, updated_at = now()
      where id = $1`,
    [groupId, nextStart],
  );
  await deps.db.query(
    `insert into module_todo.todo_seasons (group_id, number, period, started_on)
     values ($1, $2, $3, $4)
     on conflict (group_id, number) do nothing`,
    [groupId, target.seasonNumber + 1, target.powerPeriod, nextStart],
  );
  if (caller) return powerBoard(deps, caller, groupId);
  return {
    seasonNumber: target.seasonNumber + 1,
    period: target.powerPeriod,
    startedOn: nextStart,
    rows: [],
  };
}

interface GroupRow {
  id: string;
  timezone: string;
  powerEnabled: boolean;
  powerPeriod: SeasonPeriod;
  seasonNumber: number;
  seasonStartedOn: string;
}

async function loadGroup(deps: TodoDeps, groupId: string): Promise<GroupRow> {
  const { rows } = await deps.db.query(
    `select id, timezone, power_enabled,
            power_period,
            season_number,
            to_char(season_started_on, 'YYYY-MM-DD') as season_started_on
       from module_todo.todo_groups where id = $1`,
    [groupId],
  );
  if (!rows[0]) throw new TodoDomainError("not_found", "group not found");
  return {
    id: String(rows[0].id),
    timezone: String(rows[0].timezone),
    powerEnabled: rows[0].power_enabled === true,
    powerPeriod: rows[0].power_period as SeasonPeriod,
    seasonNumber: Number(rows[0].season_number),
    seasonStartedOn: String(rows[0].season_started_on),
  };
}

/** The hourly job: every group whose season period finished closes it. */
export async function closeFinishedSeasons(deps: TodoDeps): Promise<number> {
  const now = deps.now?.() ?? new Date();
  const { rows } = await deps.db.query(
    `select id, timezone, power_period,
            to_char(season_started_on, 'YYYY-MM-DD') as season_started_on
       from module_todo.todo_groups
      where power_enabled and power_period <> 'infinite'`,
  );
  let closed = 0;
  for (const row of rows) {
    const period = periodFor(
      row.power_period as Recurrence,
      String(row.season_started_on),
    );
    if (!periodEnded(period, now, String(row.timezone))) continue;
    await closeSeason(deps, null, String(row.id));
    closed += 1;
  }
  return closed;
}

export interface SeasonArchive {
  number: number;
  period: SeasonPeriod;
  startedOn: string;
  closedOn: string | null;
  rows: PowerRow[];
}

export async function listSeasons(
  deps: TodoDeps,
  caller: Caller,
  groupId: string,
): Promise<Omit<SeasonArchive, "rows">[]> {
  await requireMember(deps, caller.userId, groupId);
  const { rows } = await deps.db.query(
    `select number, period,
            to_char(started_on, 'YYYY-MM-DD') as started_on,
            to_char(closed_on, 'YYYY-MM-DD') as closed_on
       from module_todo.todo_seasons
      where group_id = $1
      order by number desc`,
    [groupId],
  );
  return rows.map((row) => ({
    number: Number(row.number),
    period: row.period as SeasonPeriod,
    startedOn: String(row.started_on),
    closedOn: row.closed_on === null ? null : String(row.closed_on),
  }));
}

export async function getSeason(
  deps: TodoDeps,
  caller: Caller,
  groupId: string,
  number: number,
): Promise<SeasonArchive> {
  await requireMember(deps, caller.userId, groupId);
  const { rows: seasons } = await deps.db.query(
    `select id, number, period,
            to_char(started_on, 'YYYY-MM-DD') as started_on,
            to_char(closed_on, 'YYYY-MM-DD') as closed_on
       from module_todo.todo_seasons
      where group_id = $1 and number = $2`,
    [groupId, number],
  );
  if (!seasons[0]) throw new TodoDomainError("not_found", "season not found");
  const { rows } = await deps.db.query(
    `select r.user_id, coalesce(p.display_name, '') as display_name,
            r.points, r.tasks_done, r.position
       from module_todo.todo_season_results r
       left join public.profiles p on p.id = r.user_id
      where r.season_id = $1
      order by r.position, r.points desc`,
    [String(seasons[0].id)],
  );
  return {
    number: Number(seasons[0].number),
    period: seasons[0].period as SeasonPeriod,
    startedOn: String(seasons[0].started_on),
    closedOn: seasons[0].closed_on === null ? null : String(seasons[0].closed_on),
    rows: rows.map((row) => ({
      userId: row.user_id === null ? null : String(row.user_id),
      displayName: String(row.display_name),
      points: Number(row.points),
      tasksDone: Number(row.tasks_done),
      position: Number(row.position),
    })),
  };
}
