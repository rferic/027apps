import { t } from "@027apps/i18n/t.js";
import type { ModulePageContext } from "@027apps/core/modules/pages.js";
import { listAllGroups } from "@027apps/owe-no/domain/service.js";

/**
 * OweNo overview for the panel: what exists on this instance. Reading only —
 * the panel never records or edits money.
 */
export default async function OweNoOverview({ context }: { context: ModulePageContext }) {
  const tr = (text: string, params?: Record<string, string | number>) =>
    t(text, context.messages, params);
  const groups = await listAllGroups({ db: context.db });
  const active = groups.filter((group) => !group.archived);
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

      {groups.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          {tr("No groups yet. The first one is created from the app.")}
        </p>
      ) : (
        <div className="flex flex-col gap-1">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {tr("Latest groups")}
          </h2>
          <ul className="flex flex-col gap-1">
            {groups.slice(0, 5).map((group) => (
              <li
                key={group.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-control border border-border px-3 py-2 text-xs"
              >
                <span className="font-semibold">{group.name}</span>
                <span className="text-muted-foreground">
                  {tr("{members} members · {movements} movements · {currency}", {
                    members: group.members,
                    movements: group.movements,
                    currency: group.currency,
                  })}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
