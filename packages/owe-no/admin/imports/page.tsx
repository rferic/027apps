import type { ComponentType } from "react";
import { t } from "@027apps/i18n/t.js";
import type { ModulePageContext } from "@027apps/core/modules/pages.js";
import { importsForGroup } from "@027apps/owe-no/domain/importer.js";

type Wizard = ComponentType<{ groupId: string; locale: string }>;

/**
 * Import from Splitwise, from the panel. The wizard is a client component the
 * host injects; this page owns the group picker and the history of that group.
 */
export default async function OweNoImports({
  context,
  ImportWizard,
}: {
  context: ModulePageContext;
  ImportWizard?: Wizard;
}) {
  const tr = (text: string, params?: Record<string, string | number>) =>
    t(text, context.messages, params);

  const { rows: groups } = await context.db.query(
    `select id, name from module_owe_no.owe_no_groups
      where created_by = $1 and archived_at is null
      order by name`,
    [context.caller.userId],
  );
  const groupId =
    typeof context.searchParams.group === "string" ? context.searchParams.group : undefined;
  const selected = groups.find((row) => String(row.id) === groupId);
  const batches = selected
    ? await importsForGroup(
        { db: context.db },
        context.caller.userId,
        String(selected.id),
      ).catch(() => [])
    : [];

  const Link = context.linkComponent ?? "a";
  const href = (id: string) => `/panel/owe-no/imports?group=${id}`;

  return (
    <section aria-labelledby="owe-no-imports" className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h1 id="owe-no-imports" className="text-base font-bold">
          {tr("Import from Splitwise")}
        </h1>
        <p className="text-xs text-muted-foreground">
          {tr(
            "Upload the CSV on the computer; the wizard previews it and asks who each name is before writing anything.",
          )}
        </p>
      </header>

      {groups.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          {tr("You need to create a group first: only its creator imports.")}
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {groups.map((group) => {
            const active = String(group.id) === String(selected?.id ?? "");
            return (
              <Link
                key={String(group.id)}
                href={href(String(group.id))}
                className={`rounded-control border px-3 py-2 text-xs font-semibold ${
                  active
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-border bg-surface text-foreground"
                }`}
              >
                {String(group.name)}
              </Link>
            );
          })}
        </div>
      )}

      {selected && ImportWizard ? (
        <ImportWizard groupId={String(selected.id)} locale={context.locale} />
      ) : null}

      {selected ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-bold">{tr("Previous imports")}</h2>
          {batches.length === 0 ? (
            <p className="text-xs text-muted-foreground">{tr("No imports yet.")}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {batches.map((batch) => (
                <li
                  key={batch.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-card border border-border bg-surface p-3 text-xs"
                >
                  <span className="text-muted-foreground">
                    {tr("{created} of {total} rows · {date}", {
                      created: batch.created_count,
                      total: batch.row_count,
                      date: new Date(batch.created_at).toISOString().slice(0, 10),
                    })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </section>
  );
}
