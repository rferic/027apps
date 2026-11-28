import { TodoDomainError } from "./errors";
import { localDate } from "./recurrence";
import {
  charLength,
  groupName as validGroupName,
  groupPower,
  type PowerPeriod,
} from "./permissions";
import type { TodoDeps, TodoGroup, TodoGroupKind } from "./types";
import { notifyOverdue } from "./overdue";
import { emitTaskReleased } from "./events";

/**
 * Groups, their members and the personal group (spec §5.1).
 *
 * A non-member gets `not_found`, never `forbidden`: the id of somebody else's
 * group must not be distinguishable from an id that does not exist.
 */

export type Caller = { userId: string; role: "user" | "admin" | "super_admin" };

export interface GroupSummary extends TodoGroup {
  memberCount: number;
  pendingCount: number;
}

export interface MemberView {
  userId: string;
  displayName: string;
  role: "owner" | "member";
  joinedAt: string;
}

const GROUP_COLUMNS = `g.id, g.name, g.kind, g.owner_id, g.timezone, g.power_enabled,
  g.power_period, g.season_number,
  to_char(g.season_started_on, 'YYYY-MM-DD') as season_started_on`;

function toGroup(row: Record<string, unknown>): TodoGroup {
  return {
    id: String(row.id),
    name: String(row.name),
    kind: row.kind as TodoGroupKind,
    ownerId: row.owner_id === null ? null : String(row.owner_id),
    timezone: String(row.timezone),
    powerEnabled: row.power_enabled === true,
    powerPeriod: row.power_period as PowerPeriod,
    seasonNumber: Number(row.season_number),
    seasonStartedOn: String(row.season_started_on),
  };
}


/**
 * A timezone the world does not know would be stored and then break every query
 * that asks PostgreSQL for the group's today, so it is refused at the edge.
 */
function validTimezone(timezone: string): string {
  if (charLength(timezone) > 64) {
    throw new TodoDomainError("validation_failed", "timezone is too long");
  }
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(new Date());
  } catch {
    throw new TodoDomainError("validation_failed", "invalid timezone");
  }
  return timezone;
}

async function run<T>(deps: TodoDeps, fn: (db: TodoDeps["db"]) => Promise<T>): Promise<T> {
  return deps.withTransaction ? deps.withTransaction(fn) : fn(deps.db);
}

/** Membership is the only way in; anything else reads as an unknown group. */
export async function requireMember(deps: TodoDeps, userId: string, groupId: string): Promise<TodoGroup> {
  const { rows } = await deps.db.query(
    `select ${GROUP_COLUMNS}
       from module_todo.todo_groups g
       join module_todo.todo_group_members m on m.group_id = g.id
      where g.id = $1 and m.user_id = $2`,
    [groupId, userId],
  );
  if (!rows[0]) throw new TodoDomainError("not_found", "group not found");
  return toGroup(rows[0]);
}

export async function requireOwner(deps: TodoDeps, userId: string, groupId: string): Promise<TodoGroup> {
  const group = await requireMember(deps, userId, groupId);
  if (group.ownerId !== userId) throw new TodoDomainError("forbidden", "only the owner manages the group");
  return group;
}

/**
 * The personal group appears the first time the user opens the module. The
 * partial unique index makes two concurrent calls collapse into one row.
 */
export async function ensurePersonalGroup(
  deps: TodoDeps,
  caller: Caller,
  input: { name: string; timezone: string },
): Promise<TodoGroup> {
  const name = validGroupName(input.name);
  return run(deps, async (db) => {
    const existing = await db.query(
      `select ${GROUP_COLUMNS} from module_todo.todo_groups g
        where g.kind = 'personal' and g.owner_id = $1`,
      [caller.userId],
    );
    if (existing.rows[0]) return toGroup(existing.rows[0]);

    await db.query(
      `insert into module_todo.todo_groups (name, kind, owner_id, timezone, power_enabled, power_period)
       values ($1, 'personal', $2, $3, false, 'infinite')
       on conflict (owner_id) where kind = 'personal' do nothing`,
      [name, caller.userId, input.timezone],
    );
    const { rows } = await db.query(
      `select ${GROUP_COLUMNS} from module_todo.todo_groups g
        where g.kind = 'personal' and g.owner_id = $1`,
      [caller.userId],
    );
    const group = toGroup(rows[0]!);
    await db.query(
      `insert into module_todo.todo_group_members (group_id, user_id, role)
       values ($1, $2, 'owner')
       on conflict (group_id, user_id) do nothing`,
      [group.id, caller.userId],
    );
    return group;
  });
}

export async function createGroup(
  deps: TodoDeps,
  caller: Caller,
  input: {
    name: string;
    timezone: string;
    powerEnabled?: boolean;
    powerPeriod?: PowerPeriod;
  },
): Promise<TodoGroup> {
  const name = validGroupName(input.name);
  const power = groupPower("group", input.powerEnabled ?? false, input.powerPeriod ?? "infinite");
  // The season starts on the group's today, from the domain clock, so a test and
  // a job agree on which season a completion belongs to.
  const timezone = validTimezone(input.timezone);
  const startedOn = localDate(deps.now?.() ?? new Date(), timezone);
  return run(deps, async (db) => {
    const { rows } = await db.query(
      `insert into module_todo.todo_groups
         (name, kind, owner_id, timezone, power_enabled, power_period, season_started_on)
       values ($1, 'group', $2, $3, $4, $5, $6)
       returning ${GROUP_COLUMNS.replaceAll("g.", "")}`,
      [name, caller.userId, timezone, power.powerEnabled, power.powerPeriod, startedOn],
    );
    const group = toGroup(rows[0]!);
    await db.query(
      `insert into module_todo.todo_group_members (group_id, user_id, role)
       values ($1, $2, 'owner')`,
      [group.id, caller.userId],
    );
    if (power.powerEnabled) {
      await db.query(
        `insert into module_todo.todo_seasons (group_id, number, period, started_on)
         values ($1, 1, $2, $3)`,
        [group.id, power.powerPeriod, startedOn],
      );
    }
    return group;
  });
}

export async function listGroups(deps: TodoDeps, caller: Caller): Promise<GroupSummary[]> {
  // Opening the module is the moment the deadline warnings are due (spec §5.6):
  // the job cannot emit them, so the sweep runs here, once per task.
  await notifyOverdue(deps, caller);
  const { rows } = await deps.db.query(
    `select ${GROUP_COLUMNS},
            (select count(*) from module_todo.todo_group_members x where x.group_id = g.id) as member_count,
            (select count(*) from module_todo.todo_tasks t
              where t.group_id = g.id and t.state = 'pending') as pending_count
       from module_todo.todo_groups g
       join module_todo.todo_group_members m on m.group_id = g.id
      where m.user_id = $1
      order by (g.kind = 'personal') desc, g.created_at`,
    [caller.userId],
  );
  return rows.map((row) => ({
    ...toGroup(row),
    memberCount: Number(row.member_count),
    pendingCount: Number(row.pending_count),
  }));
}

export async function getGroup(deps: TodoDeps, caller: Caller, groupId: string): Promise<TodoGroup> {
  return requireMember(deps, caller.userId, groupId);
}

export async function updateGroup(
  deps: TodoDeps,
  caller: Caller,
  groupId: string,
  input: {
    name?: string;
    timezone?: string;
    powerEnabled?: boolean;
    powerPeriod?: PowerPeriod;
  },
): Promise<TodoGroup> {
  const group = await requireOwner(deps, caller.userId, groupId);
  const name = input.name === undefined ? group.name : validGroupName(input.name);
  const power = groupPower(
    group.kind,
    input.powerEnabled ?? group.powerEnabled,
    input.powerPeriod ?? group.powerPeriod,
  );
  const timezone = input.timezone === undefined ? group.timezone : validTimezone(input.timezone);
  const { rows } = await deps.db.query(
    `update module_todo.todo_groups
        set name = $2, timezone = $3, power_enabled = $4, power_period = $5, updated_at = now()
      where id = $1
      returning ${GROUP_COLUMNS.replaceAll("g.", "")}`,
    [groupId, name, timezone, power.powerEnabled, power.powerPeriod],
  );
  return toGroup(rows[0]!);
}

/** Dropping a group takes its tasks and seasons with it (cascade). */
export async function deleteGroup(deps: TodoDeps, caller: Caller, groupId: string): Promise<void> {
  const group = await requireOwner(deps, caller.userId, groupId);
  if (group.kind === "personal") {
    throw new TodoDomainError("personal_group", "the personal group cannot be deleted");
  }
  await deps.db.query("delete from module_todo.todo_groups where id = $1", [groupId]);
}

export async function listMembers(
  deps: TodoDeps,
  caller: Caller,
  groupId: string,
): Promise<MemberView[]> {
  await requireMember(deps, caller.userId, groupId);
  const { rows } = await deps.db.query(
    `select m.user_id, m.role, m.joined_at, p.display_name
       from module_todo.todo_group_members m
       left join public.profiles p on p.id = m.user_id
      where m.group_id = $1
      order by (m.role = 'owner') desc, p.display_name nulls last`,
    [groupId],
  );
  return rows.map((row) => ({
    userId: String(row.user_id),
    displayName: row.display_name === null ? "" : String(row.display_name),
    role: row.role as "owner" | "member",
    joinedAt: String(row.joined_at),
  }));
}

export async function addMember(
  deps: TodoDeps,
  caller: Caller,
  groupId: string,
  userId: string,
): Promise<MemberView[]> {
  const group = await requireOwner(deps, caller.userId, groupId);
  if (group.kind === "personal") {
    throw new TodoDomainError("personal_group", "the personal group has no members");
  }
  const { rows: profile } = await deps.db.query(
    "select 1 from public.profiles where id = $1 and deactivated_at is null",
    [userId],
  );
  if (!profile[0]) throw new TodoDomainError("not_found", "user not found");
  await deps.db.query(
    `insert into module_todo.todo_group_members (group_id, user_id, role)
     values ($1, $2, 'member')
     on conflict (group_id, user_id) do nothing`,
    [groupId, userId],
  );
  return listMembers(deps, caller, groupId);
}

/**
 * Removing somebody frees their tasks back to the group and expires the requests
 * they had open (spec §5.1, D17).
 */
export async function removeMember(
  deps: TodoDeps,
  caller: Caller,
  groupId: string,
  userId: string,
): Promise<MemberView[]> {
  const group = await requireOwner(deps, caller.userId, groupId);
  if (group.kind === "personal") {
    throw new TodoDomainError("personal_group", "the personal group has no members");
  }
  if (group.ownerId === userId) {
    throw new TodoDomainError("last_owner", "the owner cannot leave the group");
  }
  let freed: Array<{ id: string; title: string }> = [];
  await run(deps, async (db) => {
    const { rows } = await db.query(
      `update module_todo.todo_tasks set assignee_id = null, updated_at = now()
        where group_id = $1 and assignee_id = $2 and state = 'pending'
        returning id, title`,
      [groupId, userId],
    );
    freed = rows.map((row) => ({ id: String(row.id), title: String(row.title) }));
    const freedIds = freed.map((task) => task.id);
    // Their open requests die, and so do the ones asking for a task that is now
    // free: nobody may inherit a request aimed at the person who left.
    await db.query(
      `update module_todo.todo_requests set state = 'expired', resolved_at = now()
        where group_id = $1 and state = 'pending'
          and (requester_id = $2 or ($3::uuid[] <> '{}' and task_id = any($3::uuid[])))`,
      [groupId, userId, freedIds],
    );
    await db.query("delete from module_todo.todo_group_members where group_id = $1 and user_id = $2", [
      groupId,
      userId,
    ]);
  });
  // The group hears that those tasks are free again (spec §5.1).
  for (const task of freed) {
    await emitTaskReleased(deps, {
      groupId,
      actorId: caller.userId,
      taskId: task.id,
      title: task.title,
    });
  }
  return listMembers(deps, caller, groupId);
}
