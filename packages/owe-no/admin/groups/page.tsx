import { t } from "@027apps/i18n/t.js";
import type { ModulePageContext } from "@027apps/core/modules/pages.js";
import { listAllGroups } from "@027apps/owe-no/domain/service.js";

/** Every group on the instance, with its size. Read-only by design. */
export default async function OweNoGroups({ context }: { context: ModulePageContext }) {
  const tr = (text: string, params?: Record<string, string | number>) =>
    t(text, context.messages, params);
  const groups = await listAllGroups({ db: context.db });

  return (
    <section aria-labelledby="owe-no-groups" className="flex flex-col gap-3">
      <header className="flex flex-col gap-1">
        <h1 id="owe-no-groups" className="text-base font-bold">
          {tr("Groups")}
        </h1>
        <p className="text-xs text-muted-foreground">
          {tr(
            "Every group, with its members and movements. Members manage their own movements from the app; the panel does not record money.",
          )}
        </p>
      </header>

      {groups.length === 0 ? (
        <p className="text-xs text-muted-foreground">{tr("No groups yet.")}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {groups.map((group) => (
            <li
              key={group.id}
              className="flex flex-col gap-1 rounded-card border border-border bg-surface p-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-semibold">{group.name}</span>
                <span className="text-xs text-muted-foreground">
                  {group.archived ? `${tr("Archived")} · ` : ""}
                  {group.currency}
                </span>
              </div>
              <span className="text-xs text-muted-foreground">
                {tr("{members} active members · {movements} movements", {
                  members: group.members,
                  movements: group.movements,
                })}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
