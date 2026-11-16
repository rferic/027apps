import type { OweDeps } from "./service";

/** One category's expense total in a period. */
export interface GroupCategoryTotal {
  name: string;
  total: number;
}

/** The group's summary, shared by the panel and the app. */
export interface GroupSummary {
  month_total: number;
  previous_month_total: number;
  expenses_total: number;
  payments_total: number;
  /** Categories with expenses in the current month, largest first. */
  category_totals: GroupCategoryTotal[];
  /** Every category of the group with its lifetime expenses, largest first. */
  category_history: GroupCategoryTotal[];
  people_totals: Array<{
    member_id: string;
    name: string;
    paid: number;
    consumed: number;
  }>;
  /** The last six months, oldest first, with their category split. */
  months: Array<{
    month: string;
    total: number;
    categories: GroupCategoryTotal[];
  }>;
  /** First live movement, so a historical total can say since when it counts. */
  first_movement_on: string | null;
}

/**
 * Aggregates one group. It does not check membership: every caller verifies
 * access first (the panel through its admin guard, the API through the door).
 * Keeping the SQL in one place is what stops the app and the panel from showing
 * different totals for the same group.
 */
export async function groupSummary(deps: OweDeps, groupId: string): Promise<GroupSummary> {
  const { rows: totals } = await deps.db.query(
    `select mv.kind, sum(mv.amount_minor)::bigint as total
       from module_owe_no.owe_no_movements mv
      where mv.group_id = $1 and mv.deleted_at is null
      group by 1`,
    [groupId],
  );
  const totalOf = (kind: string) => Number(totals.find((row) => row.kind === kind)?.total ?? 0);

  const { rows: monthRows } = await deps.db.query(
    `select coalesce(sum(mv.amount_minor) filter (
              where mv.occurred_on >= date_trunc('month', current_date)), 0)::bigint as total,
            coalesce(sum(mv.amount_minor) filter (
              where mv.occurred_on >= date_trunc('month', current_date) - interval '1 month'
                and mv.occurred_on < date_trunc('month', current_date)), 0)::bigint as previous
       from module_owe_no.owe_no_movements mv
      where mv.group_id = $1 and mv.deleted_at is null and mv.kind = 'expense'`,
    [groupId],
  );

  const { rows: peopleRows } = await deps.db.query(
    `with paid as (
       select mv.paid_by_member_id as id, sum(mv.amount_minor) as total
         from module_owe_no.owe_no_movements mv
        where mv.group_id = $1 and mv.deleted_at is null and mv.kind = 'expense'
          and mv.occurred_on >= date_trunc('month', current_date)
        group by 1
     ), consumed as (
       select s.member_id as id, sum(s.amount_minor) as total
         from module_owe_no.owe_no_movement_shares s
         join module_owe_no.owe_no_movements mv on mv.id = s.movement_id
        where mv.group_id = $1 and mv.deleted_at is null and mv.kind = 'expense'
          and mv.occurred_on >= date_trunc('month', current_date)
        group by 1
     )
     select m.id, m.display_name,
            coalesce(p.total, 0)::bigint as paid,
            coalesce(c.total, 0)::bigint as consumed
       from module_owe_no.owe_no_members m
       left join paid p on p.id = m.id
       left join consumed c on c.id = m.id
      where m.group_id = $1 and m.state = 'active'
        and (coalesce(p.total, 0) > 0 or coalesce(c.total, 0) > 0)
      order by 2 desc`,
    [groupId],
  );

  const { rows: categoryTotals } = await deps.db.query(
    `select coalesce(c.name, '') as name, sum(mv.amount_minor)::bigint as total
       from module_owe_no.owe_no_movements mv
       left join module_owe_no.owe_no_categories c on c.id = mv.category_id
      where mv.group_id = $1 and mv.deleted_at is null and mv.kind = 'expense'
        and mv.occurred_on >= date_trunc('month', current_date)
      group by 1 order by 2 desc`,
    [groupId],
  );

  const { rows: categoryHistoryRows } = await deps.db.query(
    `select c.name, coalesce(sum(mv.amount_minor), 0)::bigint as total
       from module_owe_no.owe_no_categories c
       left join module_owe_no.owe_no_movements mv
         on mv.category_id = c.id and mv.group_id = c.group_id
        and mv.deleted_at is null and mv.kind = 'expense'
      where c.group_id = $1
      group by c.name
     union all
     select '' as name, coalesce(sum(mv.amount_minor), 0)::bigint as total
       from module_owe_no.owe_no_movements mv
      where mv.group_id = $1 and mv.deleted_at is null and mv.kind = 'expense'
        and mv.category_id is null
     having coalesce(sum(mv.amount_minor), 0) > 0
      order by total desc`,
    [groupId],
  );

  const { rows: monthHistory } = await deps.db.query(
    `with span as (
       select generate_series(
         date_trunc('month', current_date) - interval '5 months',
         date_trunc('month', current_date),
         interval '1 month'
       ) as month
     )
     select to_char(s.month, 'YYYY-MM') as month,
            coalesce(sum(mv.amount_minor), 0)::bigint as total
       from span s
       left join module_owe_no.owe_no_movements mv
         on mv.group_id = $1 and mv.deleted_at is null and mv.kind = 'expense'
        and date_trunc('month', mv.occurred_on) = s.month
      group by s.month order by s.month`,
    [groupId],
  );

  const { rows: monthCategoryRows } = await deps.db.query(
    `select to_char(date_trunc('month', mv.occurred_on), 'YYYY-MM') as month,
            coalesce(c.name, '') as name,
            sum(mv.amount_minor)::bigint as total
       from module_owe_no.owe_no_movements mv
       left join module_owe_no.owe_no_categories c on c.id = mv.category_id
      where mv.group_id = $1 and mv.deleted_at is null and mv.kind = 'expense'
        and mv.occurred_on >= date_trunc('month', current_date) - interval '5 months'
      group by 1, 2
      order by 1, 3 desc`,
    [groupId],
  );

  const { rows: firstMovement } = await deps.db.query(
    `select to_char(min(occurred_on), 'YYYY-MM-DD') as first_on
       from module_owe_no.owe_no_movements
      where group_id = $1 and deleted_at is null`,
    [groupId],
  );

  return {
    month_total: Number(monthRows[0]?.total ?? 0),
    previous_month_total: Number(monthRows[0]?.previous ?? 0),
    expenses_total: totalOf("expense"),
    payments_total: totalOf("settlement"),
    category_totals: categoryTotals.map((row) => ({
      name: String(row.name),
      total: Number(row.total),
    })),
    category_history: categoryHistoryRows.map((row) => ({
      name: String(row.name),
      total: Number(row.total),
    })),
    people_totals: peopleRows.map((row) => ({
      member_id: String(row.id),
      name: String(row.display_name),
      paid: Number(row.paid),
      consumed: Number(row.consumed),
    })),
    months: monthHistory.map((row) => {
      const month = String(row.month);
      return {
        month,
        total: Number(row.total),
        categories: monthCategoryRows
          .filter((category) => String(category.month) === month && Number(category.total) > 0)
          .map((category) => ({
            name: String(category.name),
            total: Number(category.total),
          })),
      };
    }),
    first_movement_on: firstMovement[0]?.first_on ? String(firstMovement[0].first_on) : null,
  };
}
