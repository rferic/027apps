import type { TodoDeps } from "./types";

/**
 * What the panel shows about NotNow: groups, their members and their state.
 * Reading only: the domain rules live in the API, and the panel never decides
 * who may edit a task (spec §9).
 */
export interface PanelGroup {
  id: string;
  name: string;
  kind: "group" | "personal";
  ownerName: string;
  memberCount: number;
  pending: number;
  done: number;
  powerEnabled: boolean;
  powerPeriod: "infinite" | "weekly" | "monthly" | "yearly";
  seasonNumber: number;
}

export interface PanelOverview {
  groups: PanelGroup[];
  pending: number;
  done: number;
  withPower: number;
}

export async function panelOverview(deps: TodoDeps): Promise<PanelOverview> {
  const { rows } = await deps.db.query(
    `select g.id, g.name, g.kind, g.power_enabled, g.power_period, g.season_number,
            coalesce(p.display_name, '') as owner_name,
            (select count(*) from module_todo.todo_group_members m
              where m.group_id = g.id) as member_count,
            (select count(*) from module_todo.todo_tasks t
              where t.group_id = g.id and t.state = 'pending') as pending,
            (select count(*) from module_todo.todo_tasks t
              where t.group_id = g.id and t.state = 'done') as done
       from module_todo.todo_groups g
       left join public.profiles p on p.id = g.owner_id
      order by (g.kind = 'personal'), g.created_at`,
  );
  const groups = rows.map((row) => ({
    id: String(row.id),
    name: String(row.name),
    kind: row.kind as "group" | "personal",
    ownerName: String(row.owner_name),
    memberCount: Number(row.member_count),
    pending: Number(row.pending),
    done: Number(row.done),
    powerEnabled: row.power_enabled === true,
    powerPeriod: row.power_period as PanelGroup["powerPeriod"],
    seasonNumber: Number(row.season_number),
  }));
  return {
    groups,
    pending: groups.reduce((total, group) => total + group.pending, 0),
    done: groups.reduce((total, group) => total + group.done, 0),
    withPower: groups.filter((group) => group.powerEnabled).length,
  };
}
