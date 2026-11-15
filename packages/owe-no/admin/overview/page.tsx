import { t } from "@027apps/i18n/t.js";
import type { ModulePageContext } from "@027apps/core/modules/pages.js";
import { listAllGroups } from "@027apps/owe-no/domain/service.js";

interface MonthPoint {
  month: string;
  total: number;
}

interface CategoryPoint {
  name: string;
  total: number;
}

interface PersonPoint {
  name: string;
  paid: number;
  consumed: number;
}

interface CurrencyStats {
  currency: string;
  months: MonthPoint[];
  thisMonth: number;
  categories: CategoryPoint[];
  people: PersonPoint[];
}

/**
 * OweNo overview for the panel: what exists on this instance. Reading only —
 * the panel never records or edits money.
 *
 * Everything is grouped by currency: a group in euros and a trip in pounds are
 * never added together, so each currency gets its own block.
 */
export default async function OweNoOverview({ context }: { context: ModulePageContext }) {
  const tr = (text: string, params?: Record<string, string | number>) =>
    t(text, context.messages, params);
  const groups = await listAllGroups({ db: context.db });
  const active = groups.filter((group) => !group.archived);
  const money = (minor: number, currency: string) =>
    new Intl.NumberFormat(context.locale, { style: "currency", currency }).format(minor / 100);

  const monthsQuery = context.db.query(
    `select g.currency, to_char(mv.occurred_on, 'YYYY-MM') as month, sum(mv.amount_minor)::bigint as total
       from module_owe_no.owe_no_movements mv
       join module_owe_no.owe_no_groups g on g.id = mv.group_id and g.archived_at is null
      where mv.kind = 'expense' and mv.deleted_at is null
        and mv.occurred_on >= date_trunc('month', current_date) - interval '5 months'
      group by 1, 2 order by 2`,
  );
  const categoryQuery = context.db.query(
    `select g.currency, coalesce(c.name, '') as name, sum(mv.amount_minor)::bigint as total
       from module_owe_no.owe_no_movements mv
       join module_owe_no.owe_no_groups g on g.id = mv.group_id and g.archived_at is null
       left join module_owe_no.owe_no_categories c on c.id = mv.category_id
      where mv.kind = 'expense' and mv.deleted_at is null
        and mv.occurred_on >= date_trunc('month', current_date)
      group by 1, 2 order by 3 desc`,
  );
  const peopleQuery = context.db.query(
    `with paid as (
       select mv.paid_by_member_id as id, sum(mv.amount_minor) as total
         from module_owe_no.owe_no_movements mv
         join module_owe_no.owe_no_groups g on g.id = mv.group_id and g.archived_at is null
        where mv.kind = 'expense' and mv.deleted_at is null
          and mv.occurred_on >= date_trunc('month', current_date)
        group by 1
     ), consumed as (
       select s.member_id as id, sum(s.amount_minor) as total
         from module_owe_no.owe_no_movement_shares s
         join module_owe_no.owe_no_movements mv on mv.id = s.movement_id
         join module_owe_no.owe_no_groups g on g.id = mv.group_id and g.archived_at is null
        where mv.kind = 'expense' and mv.deleted_at is null
          and mv.occurred_on >= date_trunc('month', current_date)
        group by 1
     )
     select g.currency,
            m.display_name,
            coalesce(p.total, 0)::bigint as paid,
            coalesce(c.total, 0)::bigint as consumed
       from module_owe_no.owe_no_members m
       join module_owe_no.owe_no_groups g on g.id = m.group_id and g.archived_at is null
       left join paid p on p.id = m.id
       left join consumed c on c.id = m.id
      where m.state = 'active' and (coalesce(p.total, 0) > 0 or coalesce(c.total, 0) > 0)
      order by 3 desc`,
  );
  const [monthsResult, categoriesResult, peopleResult] = await Promise.all([
    monthsQuery,
    categoryQuery,
    peopleQuery,
  ]);

  const byCurrency = new Map<string, CurrencyStats>();
  const bucket = (currency: string): CurrencyStats => {
    const found = byCurrency.get(currency);
    if (found) return found;
    const created: CurrencyStats = { currency, months: [], thisMonth: 0, categories: [], people: [] };
    byCurrency.set(currency, created);
    return created;
  };
  for (const row of monthsResult.rows) {
    const stats = bucket(String(row.currency));
    stats.months.push({ month: String(row.month), total: Number(row.total) });
  }
  for (const stats of byCurrency.values()) stats.thisMonth = stats.months.at(-1)?.total ?? 0;
  for (const row of categoriesResult.rows) {
    bucket(String(row.currency)).categories.push({
      name: String(row.name) || tr("No category"),
      total: Number(row.total),
    });
  }
  for (const row of peopleResult.rows) {
    bucket(String(row.currency)).people.push({
      name: String(row.display_name),
      paid: Number(row.paid),
      consumed: Number(row.consumed),
    });
  }
  const currencies = [...byCurrency.values()]
    .map((stats) => ({
      ...stats,
      categories: stats.categories.slice(0, 6),
      people: stats.people.slice(0, 8),
    }))
    .filter((stats) => stats.months.length > 0)
    .sort((left, right) => right.thisMonth - left.thisMonth);

  const members = groups.reduce((total, group) => total + group.members, 0);
  const movements = groups.reduce((total, group) => total + group.movements, 0);

  const stats = [
    { label: tr("Active groups"), value: active.length },
    { label: tr("Archived"), value: groups.length - active.length },
    { label: tr("Members"), value: members },
    { label: tr("Movements"), value: movements },
  ];

  return (
    <section aria-labelledby="owe-no-overview" className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h1 id="owe-no-overview" className="text-base font-bold">
          OweNo
        </h1>
        <p className="text-xs text-muted-foreground">
          {tr(
            "Shared expenses and settlements. The panel reads and administers; the money lives in the app.",
          )}
        </p>
      </header>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((item) => (
          <div key={item.label} className="rounded-card border border-border bg-surface p-3">
            <dt className="text-xs text-muted-foreground">{item.label}</dt>
            <dd className="text-xl font-bold tabular-nums">{item.value}</dd>
          </div>
        ))}
      </dl>

      {currencies.map((stats) => (
        <CurrencyBlock
          key={stats.currency}
          stats={stats}
          money={(minor) => money(minor, stats.currency)}
          tr={tr}
        />
      ))}

      {groups.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          {tr("No groups yet. The first one is created from the app.")}
        </p>
      ) : null}

      <div className="flex flex-col gap-1">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {tr("Latest groups")}
        </h2>
        <ul className="flex flex-col gap-1">
          {groups.slice(0, 5).map((group) => (
            <li
              key={group.id}
              className="flex items-center justify-between rounded-control border border-border bg-surface px-3 py-2 text-xs"
            >
              <span className="truncate font-semibold">{group.name}</span>
              <span className="tabular-nums text-muted-foreground">
                {group.currency} · {group.members} {tr("members")} · {group.movements}{" "}
                {tr("movements")}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/** The three cards of one currency: this month, categories and people. */
function CurrencyBlock({
  stats,
  money,
  tr,
}: {
  stats: CurrencyStats;
  money: (minor: number) => string;
  tr: (text: string, params?: Record<string, string | number>) => string;
}) {
  const maxMonth = Math.max(1, ...stats.months.map((entry) => entry.total));
  const maxCategory = Math.max(1, ...stats.categories.map((entry) => entry.total));
  const maxPerson = Math.max(1, ...stats.people.flatMap((entry) => [entry.paid, entry.consumed]));

  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {stats.currency}
      </h2>
      <div className="grid gap-3 lg:grid-cols-3">
        <div className="flex flex-col gap-2 rounded-card border border-border bg-surface p-4">
          <span className="text-xs text-muted-foreground">{tr("This month")}</span>
          <span className="text-2xl font-bold tabular-nums">{money(stats.thisMonth)}</span>
          <div className="flex h-16 items-end gap-2">
            {stats.months.map((entry) => (
              <div key={entry.month} className="flex flex-1 flex-col items-center gap-1">
                <div
                  className="w-full rounded-t bg-accent/80"
                  style={{ height: `${Math.max(4, (entry.total / maxMonth) * 56)}px` }}
                  title={money(entry.total)}
                />
                <span className="text-[10px] text-muted-foreground">{entry.month.slice(5)}</span>
              </div>
            ))}
          </div>
          <span className="text-[11px] text-muted-foreground">{tr("Evolution")}</span>
        </div>

        <div className="flex flex-col gap-2 rounded-card border border-border bg-surface p-4">
          <span className="text-xs font-semibold">{tr("By category")}</span>
          {stats.categories.length === 0 ? (
            <span className="text-xs text-muted-foreground">{tr("No movements this month.")}</span>
          ) : (
            stats.categories.map((entry) => (
              <div key={entry.name} className="flex flex-col gap-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="truncate">{entry.name}</span>
                  <span className="tabular-nums text-muted-foreground">{money(entry.total)}</span>
                </div>
                <div className="h-2 rounded-full bg-muted">
                  <div
                    className="h-2 rounded-full bg-accent"
                    style={{ width: `${Math.max(4, (entry.total / maxCategory) * 100)}%` }}
                  />
                </div>
              </div>
            ))
          )}
        </div>

        <div className="flex flex-col gap-2 rounded-card border border-border bg-surface p-4">
          <span className="text-xs font-semibold">{tr("People")}</span>
          {stats.people.length === 0 ? (
            <span className="text-xs text-muted-foreground">{tr("No movements this month.")}</span>
          ) : (
            stats.people.map((entry) => (
              <div key={entry.name} className="flex flex-col gap-1">
                <span className="truncate text-xs">{entry.name}</span>
                <div className="h-1.5 rounded-full bg-muted">
                  <div
                    className="h-1.5 rounded-full bg-accent"
                    style={{ width: `${Math.max(4, (entry.paid / maxPerson) * 100)}%` }}
                  />
                </div>
                <div className="h-1.5 rounded-full bg-muted">
                  <div
                    className="h-1.5 rounded-full bg-muted-foreground/50"
                    style={{ width: `${Math.max(4, (entry.consumed / maxPerson) * 100)}%` }}
                  />
                </div>
              </div>
            ))
          )}
          <span className="text-[11px] text-muted-foreground">
            {tr("Paid")} · {tr("Consumed")}
          </span>
        </div>
      </div>
    </div>
  );
}
