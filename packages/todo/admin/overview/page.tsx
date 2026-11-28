import { t } from "@027apps/i18n/t.js";
import type { ModulePageContext } from "@027apps/core/modules/pages.js";
import { panelOverview } from "@027apps/todo/domain/panel.js";

/**
 * NotNow in the panel: every group on the instance and how it is doing.
 *
 * Reading only by design (spec §9): the rules of who edits, completes or deletes
 * a task live in the module's API, and the panel does not get a second opinion.
 */
export default async function TodoOverview({ context }: { context: ModulePageContext }) {
  const tr = (text: string) => t(text, context.messages);
  const data = await panelOverview({ db: context.db });
  const groups = data.groups.filter((group) => group.kind === "group");
  const personal = data.groups.filter((group) => group.kind === "personal");

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold">{tr("NotNow")}</h2>
        <p className="text-sm text-muted-foreground">
          {tr("Every group on the instance. Reading only: tasks are edited where they live.")}
        </p>
      </header>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border p-3">
          <dt className="text-xs text-muted-foreground">{tr("Groups")}</dt>
          <dd className="text-xl font-semibold">{groups.length}</dd>
        </div>
        <div className="rounded-lg border p-3">
          <dt className="text-xs text-muted-foreground">{tr("Pending")}</dt>
          <dd className="text-xl font-semibold">{data.pending}</dd>
        </div>
        <div className="rounded-lg border p-3">
          <dt className="text-xs text-muted-foreground">{tr("Done")}</dt>
          <dd className="text-xl font-semibold">{data.done}</dd>
        </div>
        <div className="rounded-lg border p-3">
          <dt className="text-xs text-muted-foreground">{tr("With power")}</dt>
          <dd className="text-xl font-semibold">{data.withPower}</dd>
        </div>
      </dl>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="py-2 pr-3">{tr("Group")}</th>
              <th className="py-2 pr-3">{tr("Owner")}</th>
              <th className="py-2 pr-3">{tr("Members")}</th>
              <th className="py-2 pr-3">{tr("Pending")}</th>
              <th className="py-2 pr-3">{tr("Done")}</th>
              <th className="py-2">{tr("Power")}</th>
            </tr>
          </thead>
          <tbody>
            {groups.length === 0 && (
              <tr>
                <td colSpan={6} className="py-6 text-center text-muted-foreground">
                  {tr("No groups yet.")}
                </td>
              </tr>
            )}
            {groups.map((group) => (
              <tr key={group.id} className="border-b">
                <td className="py-2 pr-3 font-medium">{group.name}</td>
                <td className="py-2 pr-3">{group.ownerName}</td>
                <td className="py-2 pr-3">{group.memberCount}</td>
                <td className="py-2 pr-3">{group.pending}</td>
                <td className="py-2 pr-3">{group.done}</td>
                <td className="py-2">
                  {group.powerEnabled
                    ? `${tr(group.powerPeriod)} · ${"#" + group.seasonNumber}`
                    : tr("Off")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">
        {tr("Personal groups")}: {personal.length} ·{" "}
        {tr("their content stays private and is not opened here.")}
      </p>
    </section>
  );
}
