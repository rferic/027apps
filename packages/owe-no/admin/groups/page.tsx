import { t } from "@027apps/i18n/t.js";
import type { ComponentType } from "react";
import type { ModulePageContext } from "@027apps/core/modules/pages.js";
import type {
  AdminGroupDetail,
  AdminGroupView,
  AdminUserOption,
} from "../../src/admin";
import type { ImportBatchView } from "../../src/importer";
import type { MovementView } from "../../src/service";
import type { SettlementPlan } from "../../src/settlement";
import { ConfirmForm } from "../components/confirm-form";

type Action = (formData: FormData) => Promise<void>;
type ImportWizard = ComponentType<{ groupId: string; locale: string }>;

export interface OweNoGroupsActions {
  createGroup: Action;
  archiveGroup: Action;
  deleteGroup: Action;
  addMember: Action;
  linkMember: Action;
  removeMember: Action;
  saveMovement: Action;
  deleteMovement: Action;
  settle: Action;
  transfer: Action;
}

const ERROR_KEYS: Record<string, string> = {
  member_has_balance: "That member still has a balance. Settle it first.",
  member_exists: "That account is already in the group.",
  member_linked: "That member already has an account.",
  last_member: "A group needs at least one active member.",
  group_archived: "The group is archived. Reopen it to make changes.",
  kind_immutable: "A movement cannot change between expense and settlement.",
  confirmation_mismatch: "The name does not match. Type it exactly as it appears.",
  validation_failed: "Check the values and try again.",
  forbidden: "You do not have permission to do that.",
  failed: "Something went wrong. Try again.",
};

const control =
  "min-h-11 rounded-control border border-border bg-background px-2.5 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const primary =
  "inline-flex min-h-11 items-center justify-center rounded-control bg-accent px-3 text-xs font-semibold text-accent-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const link =
  "inline-flex min-h-11 items-center text-xs font-semibold text-accent hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const secondary =
  "inline-flex min-h-11 items-center justify-center rounded-control border border-border px-3 text-xs font-semibold hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

const STATE_KEYS: Record<string, string> = {
  invited: "Invited",
  active: "Active",
  left: "Left",
  removed: "Removed",
};

type Anchor = NonNullable<ModulePageContext["linkComponent"]> | "a";

const anchorOf = (context: ModulePageContext): Anchor => context.linkComponent ?? "a";

const today = () => new Date().toISOString().slice(0, 10);

/** The codes an action can return, translated for the inline form error. */
function formErrors(tr: (text: string) => string): Record<string, string> {
  return Object.fromEntries(
    Object.entries(ERROR_KEYS).map(([code, text]) => [code, tr(text)]),
  );
}

function money(minor: number, currency: string, locale: string): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(minor / 100);
  } catch {
    return `${(minor / 100).toFixed(2)} ${currency}`;
  }
}

function href(groupId: string, view?: string, extra?: Record<string, string>): string {
  const params = new URLSearchParams({ group: groupId });
  if (view) params.set("view", view);
  for (const [key, value] of Object.entries(extra ?? {})) params.set(key, value);
  return `?${params.toString()}`;
}

/**
 * OweNo groups in the panel (D26). Every data-entry form has its own page, as
 * in the rest of the panel: the group view only reads and links to the form it
 * needs. The page is presentational; writes arrive as Server Actions from the
 * app wrapper, so the package never depends on Next.
 */
export default async function OweNoGroups({
  context,
  groups,
  detail,
  userOptions,
  plan,
  actions,
  ImportWizard,
  imports = [],
}: {
  context: ModulePageContext;
  groups: AdminGroupView[];
  detail: AdminGroupDetail | null;
  userOptions: AdminUserOption[];
  plan: SettlementPlan | null;
  actions: OweNoGroupsActions;
  /** The panel injects its client wizard; the package stays Next-free. */
  ImportWizard?: ImportWizard;
  /** Batches of the group when the imports tab is open. */
  imports?: ImportBatchView[];
}) {
  const tr = (text: string, params?: Record<string, string | number>) =>
    t(text, context.messages, params);
  const errorCode = typeof context.searchParams.error === "string" ? context.searchParams.error : "";
  const error = errorCode ? tr(ERROR_KEYS[errorCode] ?? ERROR_KEYS.failed) : "";
  const view = typeof context.searchParams.view === "string" ? context.searchParams.view : "";
  const editId = typeof context.searchParams.edit === "string" ? context.searchParams.edit : "";
  const memberId = typeof context.searchParams.member === "string" ? context.searchParams.member : "";

  return (
    <section className="flex flex-col gap-4">
      {error ? (
        <p
          role="alert"
          className="rounded-control border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
        >
          {error}
        </p>
      ) : null}

      {detail ? (
        view === "movement" ? (
          <MovementView
            context={context}
            detail={detail}
            editId={editId}
            actions={actions}
            tr={tr}
          />
        ) : view === "settle" ? (
          <SettleView
            context={context}
            detail={detail}
            plan={plan}
            actions={actions}
            tr={tr}
          />
        ) : view === "member" ? (
          <MemberView
            context={context}
            detail={detail}
            userOptions={userOptions}
            actions={actions}
            tr={tr}
          />
        ) : view === "link" ? (
          <LinkView
            context={context}
            detail={detail}
            userOptions={userOptions}
            memberId={memberId}
            actions={actions}
            tr={tr}
          />
        ) : (
          <GroupDetail
            context={context}
            detail={detail}
            actions={actions}
            imports={imports}
            ImportWizard={ImportWizard}
            tr={tr}
          />
        )
      ) : context.searchParams.new === "1" ? (
        <NewGroup context={context} actions={actions} tr={tr} />
      ) : (
        <GroupList context={context} groups={groups} actions={actions} tr={tr} />
      )}
    </section>
  );
}

function PageHeader({
  title,
  description,
  backHref,
  backLabel,
  anchor = "a",
  children,
  tr,
}: {
  title: React.ReactNode;
  description?: string;
  backHref?: string;
  backLabel?: string;
  anchor?: Anchor;
  children?: React.ReactNode;
  tr: (text: string, params?: Record<string, string | number>) => string;
}) {
  const AnchorTag = anchor;
  return (
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex flex-col gap-1">
        {backHref && backLabel ? (
          <AnchorTag href={backHref} className="text-xs text-muted-foreground hover:underline">
            ← {tr(backLabel)}
          </AnchorTag>
        ) : null}
        <h1 className="text-base font-bold">{title}</h1>
        {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
      </div>
      {children}
    </header>
  );
}

function Field({
  label,
  children,
  wide = false,
}: {
  label: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <label className={`flex flex-col gap-1 text-xs font-semibold ${wide ? "min-w-48 flex-1" : ""}`}>
      {label}
      {children}
    </label>
  );
}

function GroupList({
  context,
  groups,
  tr,
}: {
  context: ModulePageContext;
  groups: AdminGroupView[];
  actions: OweNoGroupsActions;
  tr: (text: string, params?: Record<string, string | number>) => string;
}) {
  const AnchorTag = anchorOf(context);
  return (
    <>
      <PageHeader
        title={tr("Groups")}
        description={tr(
          "Every group, with its members and movements. Members manage their own movements from the app; the panel does not record money.",
        )}
        backHref="/panel/owe-no"
        backLabel="OweNo"
        anchor={anchorOf(context)}
        tr={tr}
      >
        <AnchorTag href="?new=1" className={primary}>
          {tr("New group")}
        </AnchorTag>
      </PageHeader>

      <form method="get" className="flex flex-wrap items-end gap-2">
        <label className="flex min-w-48 flex-1 flex-col gap-1 text-xs font-semibold">
          {tr("Search groups")}
          <input
            name="q"
            defaultValue={
              typeof context.searchParams.q === "string" ? context.searchParams.q : ""
            }
            className={`${control} font-normal`}
          />
        </label>
        <button type="submit" className={secondary}>
          {tr("Search")}
        </button>
        {context.searchParams.q ? (
          <AnchorTag href="?" className={link}>
            {tr("Clear filter")}
          </AnchorTag>
        ) : null}
      </form>

      {groups.length === 0 ? (
        <p className="text-xs text-muted-foreground">{tr("No groups yet.")}</p>
      ) : (
        <div className="overflow-x-auto rounded-card border border-border bg-surface">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="text-muted-foreground">
                <th className="border-b border-border p-3 font-semibold">{tr("Group")}</th>
                <th className="border-b border-border p-3 font-semibold">{tr("Members")}</th>
                <th className="border-b border-border p-3 font-semibold">{tr("Movements")}</th>
                <th className="border-b border-border p-3 font-semibold">{tr("State")}</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((group) => (
                <tr key={group.id}>
                  <td className="border-b border-border p-3">
                    <AnchorTag
                      href={href(group.id)}
                      className="font-semibold text-accent hover:underline"
                    >
                      {group.name}
                    </AnchorTag>
                    <span className="ml-2 font-mono text-[11px] text-muted-foreground">
                      {group.currency}
                    </span>
                  </td>
                  <td className="border-b border-border p-3">{group.members}</td>
                  <td className="border-b border-border p-3">{group.movements}</td>
                  <td className="border-b border-border p-3">
                    {group.archived ? tr("Archived") : tr("Active")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function NewGroup({
  context,
  actions,
  tr,
}: {
  context: ModulePageContext;
  actions: OweNoGroupsActions;
  tr: (text: string, params?: Record<string, string | number>) => string;
}) {
  return (
    <>
      <PageHeader
        title={tr("New group")}
        description={tr("The group starts with you as its creator and first member.")}
        backHref="?"
        backLabel="Groups"
        anchor={anchorOf(context)}
        tr={tr}
      />
      <section className="max-w-xl rounded-card border border-border bg-surface p-4">
                <form action={actions.createGroup} className="flex flex-col gap-3">
          <Field label={tr("Group name")}>
            <input
              name="name"
              required
              autoFocus
              maxLength={80}
              autoCapitalize="words"
              className={`${control} font-normal`}
            />
          </Field>
          <Field label={tr("Currency")}>
            <input
              name="currency"
              defaultValue="EUR"
              maxLength={3}
              required
              className={`${control} w-32 font-mono font-normal uppercase`}
            />
          </Field>
                  <div className="flex flex-wrap items-center justify-end gap-3">
            <a href="?" className={link}>
              {tr("Cancel")}
            </a>
            <button type="submit" className={primary}>
              {tr("Create")}
            </button>
          </div>
        </form>
      </section>
    </>
  );
}

function GroupDetail({
  context,
  detail,
  actions,
  imports,
  ImportWizard,
  tr,
}: {
  context: ModulePageContext;
  detail: AdminGroupDetail;
  actions: OweNoGroupsActions;
  imports: ImportBatchView[];
  ImportWizard?: ImportWizard;
  tr: (text: string, params?: Record<string, string | number>) => string;
}) {
  const AnchorTag = anchorOf(context);
  const { group, members, movements } = detail;
  const tabParam = context.searchParams.tab;
  const canImport = group.created_by !== null && group.created_by === context.caller.userId;
  const tab =
    tabParam === "movements" ||
    tabParam === "balances" ||
    tabParam === "members" ||
    tabParam === "summary" ||
    (tabParam === "imports" && canImport)
      ? tabParam
      : "summary";
  const tabHref = (value: string) => href(group.id, undefined, { tab: value });
  const active = members.filter((member) => member.state === "active");
  const byId = new Map(members.map((member) => [member.id, member.display_name]));
  const tabs = [
    { key: "summary", label: tr("Summary") },
    { key: "movements", label: tr("Movements") },
    { key: "balances", label: tr("Balances") },
    { key: "members", label: tr("Members") },
    ...(canImport ? [{ key: "imports", label: tr("Import from Splitwise") }] : []),
  ];

  return (
    <>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-2">
            {group.name}
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
              {group.archived ? tr("Archived") : tr("Active")} · {group.currency}
            </span>
          </span>
        }
        description={tr(
          "Members {members} · Movements {movements} · Historical expenses {expenses}",
          {
            members: group.members,
            movements: group.movements,
            expenses: money(detail.expenses_total, group.currency, context.locale),
          },
        )}
        tr={tr}
      >
        {/* Only the two day-to-day actions live here. Archiving and deleting
            wait at the bottom of the page, behind "Danger zone". */}
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
          {!group.archived ? (
            <AnchorTag href={href(group.id, "movement")} className={`${primary} whitespace-nowrap`}>
              {tr("Add expense")}
            </AnchorTag>
          ) : null}
          {!group.archived ? (
            <AnchorTag href={href(group.id, "settle")} className={`${secondary} whitespace-nowrap`}>
              {tr("Settle up")}
            </AnchorTag>
          ) : null}
        </div>
      </PageHeader>

      <nav
        className="flex flex-wrap gap-1 rounded-card border border-border bg-surface p-1 text-xs"
        aria-label={tr("Group sections")}
      >
        {tabs.map((entry) => (
          <AnchorTag
            key={entry.key}
            href={tabHref(entry.key)}
            aria-current={tab === entry.key ? "page" : undefined}
            className={`min-h-9 rounded-control px-3 py-1.5 font-semibold ${
              tab === entry.key ? "bg-accent/10 text-accent" : "text-muted-foreground"
            }`}
          >
            {entry.label}
          </AnchorTag>
        ))}
      </nav>

      {tab === "balances" ? (
      <dl className="grid max-w-3xl grid-cols-2 gap-2 sm:grid-cols-3">
        {active.map((member) => (
          <div key={member.id} className="rounded-card border border-border bg-surface p-3">
            <dt className="truncate text-xs text-muted-foreground">{member.display_name}</dt>
            <dd
              className={`text-lg font-bold tabular-nums ${
                member.balance > 0 ? "text-success" : member.balance < 0 ? "text-destructive" : ""
              }`}
            >
              {member.balance > 0 ? "+" : ""}
              {money(member.balance, group.currency, context.locale)}
            </dd>
          </div>
        ))}
      </dl>
      ) : null}

      {tab === "members" ? (
      <section className="rounded-card border border-border bg-surface p-3">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {tr("Members")}
          </h2>
          {!group.archived ? (
            <AnchorTag href={href(group.id, "member")} className={link}>
              {tr("Add member")}
            </AnchorTag>
          ) : null}
        </div>
        <ul className="flex flex-col divide-y divide-border">
          {members.map((member) => (
            <li key={member.id} className="flex flex-wrap items-center gap-2 py-2 text-xs">
              <span className="font-semibold">{member.display_name}</span>
              <span className="text-[11px] text-muted-foreground">
                {member.user_id ? tr("Linked account") : tr("Fictitious member")} ·{" "}
                {tr(STATE_KEYS[member.state] ?? "Active")}
              </span>
              <span
                className={`ml-auto tabular-nums ${
                  member.balance > 0
                    ? "text-success"
                    : member.balance < 0
                      ? "text-destructive"
                      : "text-muted-foreground"
                }`}
              >
                {member.balance > 0 ? "+" : ""}
              {money(member.balance, group.currency, context.locale)}
              </span>
              {!group.archived && member.state === "active" ? (
                <span className="flex items-center gap-1">
                  {!member.user_id ? (
                    <AnchorTag href={href(group.id, "link", { member: member.id })} className={`${secondary} px-2 text-[11px]`}>
                      {tr("Link account")}
                    </AnchorTag>
                  ) : null}
                  <ConfirmForm
                    action={actions.removeMember}
                    fields={{ group: group.id, member: member.id, tab }}
                    label={tr("Remove")}
                    title={tr("Remove member?")}
                    body={tr("Their balance must be zero; a removed member could no longer be paid.")}
                    confirmLabel={tr("Remove")}
                    cancelLabel={tr("Cancel")}
                    size="sm"
                  />
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      ) : null}

      {tab === "summary" ? <GroupSummary context={context} detail={detail} tr={tr} /> : null}

      {tab === "imports" ? (
        <section className="flex max-w-3xl flex-col gap-3 rounded-card border border-border bg-surface p-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {tr("Import from Splitwise")}
          </h2>
          {ImportWizard ? (
            <ImportWizard groupId={group.id} locale={context.locale} />
          ) : null}
          <h3 className="text-sm font-bold">{tr("Previous imports")}</h3>
          {imports.length === 0 ? (
            <p className="text-xs text-muted-foreground">{tr("No imports yet.")}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {imports.map((batch) => (
                <li
                  key={batch.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-card border border-border p-3 text-xs"
                >
                  <span className="text-muted-foreground">
                    {tr("{created} of {total} rows · {date}", {
                      created: batch.created_count,
                      total: batch.row_count,
                      date: batch.created_at.slice(0, 10),
                    })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {tab === "movements" ? (
      <section className="rounded-card border border-border bg-surface p-3">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {tr("Movements")}
        </h2>
        <MovementFilters
          context={context}
          detail={detail}
          tr={tr}
        />
        <p className="mb-2 text-[11px] text-muted-foreground">
          {tr("Showing {shown} of {total} movements.", {
            shown: movements.length,
            total: detail.movements_total,
          })}
        </p>
        {movements.length === 0 ? (
          <p className="text-xs text-muted-foreground">{tr("No movements yet.")}</p>
        ) : (
          <>
          <ul className="flex flex-col divide-y divide-border sm:hidden">
            {movements.map((movement) => (
              <li key={movement.id} className="flex flex-col gap-1 py-2 text-xs">
                <span className="flex items-start justify-between gap-2">
                  <span className="font-semibold">
                    {movement.kind === "settlement" ? tr("Settlement") : movement.description}
                  </span>
                  <span className="whitespace-nowrap tabular-nums">
                    {money(movement.amount_minor, movement.currency, context.locale)}
                  </span>
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {movement.occurred_on} · {byId.get(movement.paid_by) ?? ""} ·{" "}
                  {movement.kind === "settlement" ? tr("Settlement") : tr("Expense")}
                  {movement.category_id
                    ? ` · ${
                        detail.categories.find((category) => category.id === movement.category_id)
                          ?.name ?? ""
                      }`
                    : ""}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {movement.updated_by_name
                    ? tr("Edited by {name}", { name: movement.updated_by_name })
                    : movement.created_by_name
                      ? tr("Added by {name}", { name: movement.created_by_name })
                      : null}
                </span>
                {!group.archived ? (
                  <span className="flex items-center gap-2">
                    <AnchorTag
                      href={href(group.id, "movement", { edit: movement.id })}
                      className="inline-flex min-h-9 items-center rounded-control border border-border px-2 text-[11px] font-semibold"
                    >
                      {tr("Edit")}
                    </AnchorTag>
                    <ConfirmForm
                      action={actions.deleteMovement}
                      fields={{ group: group.id, movement: movement.id }}
                      label={tr("Delete")}
                      title={tr("Delete movement?")}
                      body={tr("It leaves the balances and the history; the row stays for audit.")}
                      confirmLabel={tr("Delete")}
                      cancelLabel={tr("Cancel")}
                      size="sm"
                      suffix="mobile"
                    />
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
          <div className="hidden overflow-x-auto sm:block">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="text-muted-foreground">
                  <th className="border-b border-border p-2 font-semibold">{tr("Date")}</th>
                  <th className="border-b border-border p-2 font-semibold">{tr("Description")}</th>
                  <th className="border-b border-border p-2 font-semibold">{tr("Paid by")}</th>
                  <th className="border-b border-border p-2 text-right font-semibold">{tr("Amount")}</th>
                  <th className="border-b border-border p-2 text-right font-semibold">{tr("Actions")}</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((movement) => (
                  <tr key={movement.id}>
                    <td className="whitespace-nowrap border-b border-border p-2">
                      {movement.occurred_on}
                    </td>
                    <td className="border-b border-border p-2">
                      <span className="font-semibold">
                        {movement.kind === "settlement" ? tr("Settlement") : movement.description}
                      </span>
                      <span className="ml-2 text-[11px] text-muted-foreground">
                        {movement.kind === "settlement" ? tr("Settlement") : tr("Expense")}
                        {movement.category_id
                          ? ` · ${
                              detail.categories.find(
                                (category) => category.id === movement.category_id,
                              )?.name ?? ""
                            }`
                          : ""}
                      </span>
                      <span className="block text-[10px] text-muted-foreground">
                        {movement.updated_by_name
                          ? tr("Edited by {name}", { name: movement.updated_by_name })
                          : movement.created_by_name
                            ? tr("Added by {name}", { name: movement.created_by_name })
                            : null}
                      </span>
                    </td>
                    <td className="border-b border-border p-2">{byId.get(movement.paid_by) ?? ""}</td>
                    <td className="border-b border-border p-2 text-right tabular-nums">
                      {money(movement.amount_minor, movement.currency, context.locale)}
                    </td>
                    <td className="border-b border-border p-2 text-right">
                      {!group.archived ? (
                        <span className="inline-flex items-center gap-1">
                          <AnchorTag
                            href={href(group.id, "movement", { edit: movement.id })}
                            className="rounded-control border border-border px-2 py-1 text-[11px] font-semibold"
                          >
                            {tr("Edit")}
                          </AnchorTag>
                          <ConfirmForm
                            action={actions.deleteMovement}
                            fields={{ group: group.id, movement: movement.id, tab }}
                            label={tr("Delete")}
                            title={tr("Delete movement?")}
                            body={tr("It leaves the balances and the history; the row stays for audit.")}
                            confirmLabel={tr("Delete")}
                            cancelLabel={tr("Cancel")}
                            size="sm"
                            suffix="desktop"
                          />
                        </span>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        )}
        <MovementPager context={context} detail={detail} tr={tr} />
      </section>
      ) : null}

      {/* Archiving and deleting are irreversible or close to it: they wait at
          the bottom, collapsed, instead of competing with "Add expense". */}
      <details className="max-w-3xl rounded-card border border-destructive/40 bg-surface p-3">
        <summary className="cursor-pointer text-xs font-semibold text-destructive">
          {tr("Danger zone")}
        </summary>
        <div className="mt-3 flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <p className="text-[11px] text-muted-foreground">
              {group.archived
                ? tr("The group becomes writable again.")
                : tr("The group becomes read-only for everyone.")}
            </p>
            <ConfirmForm
              action={actions.archiveGroup}
              fields={{ group: group.id, archived: group.archived ? "false" : "true", tab }}
              label={group.archived ? tr("Reopen group") : tr("Archive group")}
              title={group.archived ? tr("Reopen group?") : tr("Archive group?")}
              body={
                group.archived
                  ? tr("The group becomes writable again.")
                  : tr("The group becomes read-only for everyone.")
              }
              confirmLabel={group.archived ? tr("Reopen group") : tr("Archive group")}
              cancelLabel={tr("Cancel")}
              variant="neutral"
              confirmVariant="primary"
              className="w-fit"
            />
          </div>
          <div className="flex flex-col gap-2 border-t border-border pt-3">
            <p className="text-[11px] text-muted-foreground">
              {tr("Deleting the group cannot be undone.")}
            </p>
            <form action={actions.deleteGroup} className="flex max-w-md flex-col gap-2">
              <input type="hidden" name="group" value={group.id} />
              <input type="hidden" name="tab" value={tab} />
              <label className="flex flex-col gap-1 text-[11px]">
                {tr("Type the group name to confirm: {name}", { name: group.name })}
                <input
                  name="confirm"
                  autoComplete="off"
                  className="min-h-11 rounded-control border border-border bg-background px-2 text-sm"
                />
              </label>
              <button
                type="submit"
                className="min-h-11 w-fit rounded-control bg-destructive px-3 text-xs font-semibold text-background"
              >
                {tr("Delete group")}
              </button>
            </form>
          </div>
        </div>
      </details>
    </>
  );
}

function MovementView({
  context,
  detail,
  editId,
  actions,
  tr,
}: {
  context: ModulePageContext;
  detail: AdminGroupDetail;
  editId: string;
  actions: OweNoGroupsActions;
  tr: (text: string, params?: Record<string, string | number>) => string;
}) {
  const { group, members } = detail;
  const active = members.filter((member) => member.state === "active");
  const editing = editId ? detail.movements.find((movement) => movement.id === editId) : undefined;
  const shareOf = (memberId: string) =>
    editing?.shares.find((share) => share.memberId === memberId)?.amount_minor;
  const equal = editing ? Math.round(editing.amount_minor / Math.max(editing.shares.length, 1)) : null;
  const exact = editing ? editing.shares.some((share) => share.amount_minor !== equal) : false;

  return (
    <>
      <PageHeader
        title={
          editing
            ? editing.kind === "settlement"
              ? tr("Edit settlement")
              : tr("Edit expense")
            : tr("Add expense")
        }
        description={tr("A movement of {group}. The split is recalculated when you save.", {
          group: group.name,
        })}
        backHref={href(group.id)}
        backLabel={group.name}
        anchor={anchorOf(context)}
        tr={tr}
      />
      <section className="max-w-3xl rounded-card border border-border bg-surface p-4">
                <form action={actions.saveMovement} className="flex flex-col gap-3">
          <input type="hidden" name="group" value={group.id} />
              <input type="hidden" name="tab" value="movements" />
          {editing ? <input type="hidden" name="movement" value={editing.id} /> : null}
          <input type="hidden" name="kind" value={editing?.kind ?? "expense"} />
          <div className="flex flex-wrap gap-2">
            <Field label={tr("Description")} wide>
              <input
                name="description"
                required
                autoFocus
                autoCapitalize="sentences"
                maxLength={200}
                defaultValue={editing?.description ?? ""}
                className={`${control} font-normal`}
              />
            </Field>
            <Field label={`${tr("Amount")} (${group.currency})`}>
              <input
                name="amount"
                required
                inputMode="decimal"
                pattern="[0-9]+([.,][0-9]{1,2})?"
                title={tr("Amount")}
                defaultValue={editing ? (editing.amount_minor / 100).toFixed(2) : ""}
                className={`${control} w-28 text-right font-normal tabular-nums`}
              />
            </Field>
            <Field label={tr("Date")}>
              <input
                type="date"
                name="occurred_on"
                required
                defaultValue={editing?.occurred_on ?? today()}
                className={`${control} font-normal`}
              />
            </Field>
            <Field label={tr("Paid by")}>
              <select
                name="paid_by"
                required
                defaultValue={editing?.paid_by ?? active[0]?.id ?? ""}
                className={`${control} font-normal`}
              >
                {active.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.display_name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={tr("Split")}>
              <select
                name="mode"
                defaultValue={exact ? "exact" : "equal"}
                className={`${control} font-normal`}
              >
                <option value="equal">{tr("Equal parts")}</option>
                <option value="exact">{tr("Exact amounts")}</option>
              </select>
            </Field>
            <Field label={tr("Category")}>
              <select
                name="category_id"
                defaultValue={editing?.category_id ?? ""}
                className={`${control} font-normal`}
              >
                <option value="">{tr("No category")}</option>
                {detail.categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <fieldset className="flex flex-col gap-1 rounded-control border border-border p-2">
            <legend className="px-1 text-xs font-semibold text-muted-foreground">
              {tr("Participants")}
            </legend>
            {active.map((member) => {
              const selected =
                editing?.shares.some((share) => share.memberId === member.id) ?? true;
              const amount = shareOf(member.id);
              return (
                <label key={member.id} className="flex items-center gap-2 py-1 text-xs">
                  <input
                    type="checkbox"
                    name="participants"
                    value={member.id}
                    defaultChecked={selected}
                    className="accent-accent"
                  />
                  <span className="min-w-24">{member.display_name}</span>
                  <input
                    name={`amount_${member.id}`}
                    inputMode="decimal"
                    pattern="[0-9]+([.,][0-9]{1,2})?"
                    placeholder={tr("Exact")}
                    defaultValue={amount === undefined ? "" : (amount / 100).toFixed(2)}
                    className={`${control} ml-auto w-24 text-right text-[11px] font-normal tabular-nums`}
                  />
                </label>
              );
            })}
            <span className="text-[10px] text-muted-foreground">
              {tr("Amounts are only used in exact mode; the rest splits equally.")}
            </span>
          </fieldset>

                  <div className="flex flex-wrap items-center justify-end gap-3">
            <a href={href(group.id)} className={link}>
              {tr("Cancel")}
            </a>
            <button type="submit" className={primary}>
              {editing ? tr("Save changes") : tr("Save expense")}
            </button>
          </div>
        </form>
      </section>
    </>
  );
}

function SettleView({
  context,
  detail,
  plan,
  actions,
  tr,
}: {
  context: ModulePageContext;
  detail: AdminGroupDetail;
  plan: SettlementPlan | null;
  actions: OweNoGroupsActions;
  tr: (text: string, params?: Record<string, string | number>) => string;
}) {
  const { group, members } = detail;
  const active = members.filter((member) => member.state === "active");
  const byId = new Map(active.map((member) => [member.id, member.display_name]));

  return (
    <>
      <PageHeader
        title={tr("Settle up")}
        description={tr("Each payment is recorded as a settlement movement.")}
        backHref={href(group.id)}
        backLabel={group.name}
        anchor={anchorOf(context)}
        tr={tr}
      />
      <section className="max-w-2xl rounded-card border border-border bg-surface p-4">
        {plan && plan.transfers.length > 0 ? (
          <ul className="mb-4 flex flex-col divide-y divide-border rounded-control border border-border">
            {plan.transfers.map((transfer) => (
              <li
                key={`${transfer.from}-${transfer.to}`}
                className="flex flex-wrap items-center gap-2 p-2 text-xs"
              >
                <span className="font-semibold">{byId.get(transfer.from) ?? transfer.from}</span>
                <span aria-hidden="true">→</span>
                <span className="font-semibold">{byId.get(transfer.to) ?? transfer.to}</span>
                <span className="ml-auto tabular-nums">
                  {money(transfer.amount_minor, group.currency, context.locale)}
                </span>
                <form action={actions.transfer}>
                  <input type="hidden" name="group" value={group.id} />
              <input type="hidden" name="tab" value="balances" />
                  <input type="hidden" name="from" value={transfer.from} />
                  <input type="hidden" name="to" value={transfer.to} />
                  <input
                    type="hidden"
                    name="amount"
                    value={(transfer.amount_minor / 100).toFixed(2)}
                  />
                  <input type="hidden" name="occurred_on" value={today()} />
                  <input type="hidden" name="description" value="Settlement" />
                  <button type="submit" className={primary}>
                    {tr("Register payment")}
                  </button>
                </form>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mb-4 text-xs text-muted-foreground">{tr("Everyone is settled.")}</p>
        )}

        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {tr("Register payment")}
        </h2>
                <form action={actions.settle} className="flex flex-col gap-3">
          <input type="hidden" name="group" value={group.id} />
              <input type="hidden" name="tab" value="balances" />
          <input type="hidden" name="occurred_on" value={today()} />
          <input type="hidden" name="description" value="Settlement" />
          <div className="flex flex-wrap items-end gap-2">
            <Field label={tr("Who pays")}>
              <select name="from" required className={`${control} font-normal`}>
                {active.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.display_name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={tr("Who receives")}>
              <select name="to" required className={`${control} font-normal`}>
                {active.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.display_name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={`${tr("Amount")} (${group.currency})`}>
              <input
                name="amount"
                required
                inputMode="decimal"
                className={`${control} w-28 text-right font-normal tabular-nums`}
              />
            </Field>
          </div>
                  <div className="flex flex-wrap items-center justify-end gap-3">
            <a href={href(group.id)} className={link}>
              {tr("Cancel")}
            </a>
            <button type="submit" className={primary}>
              {tr("Register payment")}
            </button>
          </div>
        </form>
      </section>
    </>
  );
}

function MemberView({
  context,
  detail,
  userOptions,
  actions,
  tr,
}: {
  context: ModulePageContext;
  detail: AdminGroupDetail;
  userOptions: AdminUserOption[];
  actions: OweNoGroupsActions;
  tr: (text: string, params?: Record<string, string | number>) => string;
}) {
  const linked = new Set(
    detail.members.map((member) => member.user_id).filter((id): id is string => id !== null),
  );
  return (
    <>
      <PageHeader
        title={tr("Add member")}
        description={tr("The member is active from the moment you add them; there is no email invitation.")}
        backHref={href(detail.group.id)}
        backLabel={detail.group.name}
        anchor={anchorOf(context)}
        tr={tr}
      />
      <section className="max-w-xl rounded-card border border-border bg-surface p-4">
                <form action={actions.addMember} className="flex flex-col gap-3">
          <input type="hidden" name="group" value={detail.group.id} />
          <Field label={tr("Name")}>
            <input
              name="display_name"
              required
              autoFocus
              maxLength={80}
              autoCapitalize="words"
              className={`${control} font-normal`}
            />
          </Field>
          <Field label={tr("Account (optional)")}>
            <select name="user_id" defaultValue="" className={`${control} font-normal`}>
              <option value="">{tr("No account")}</option>
              {userOptions.map((option) => (
                <option key={option.id} value={option.id} disabled={linked.has(option.id)}>
                  {option.display_name}
                  {linked.has(option.id) ? ` · ${tr("Already in the group")}` : ""}
                </option>
              ))}
            </select>
          </Field>
          <p className="text-[11px] text-muted-foreground">
            {tr(
              "If your account does not appear, it is already in the group. Accounts already here cannot be added twice.",
            )}
          </p>
                  <div className="flex flex-wrap items-center justify-end gap-3">
            <a href={href(detail.group.id)} className={link}>
              {tr("Cancel")}
            </a>
            <button type="submit" className={primary}>
              {tr("Add member")}
            </button>
          </div>
        </form>
      </section>
    </>
  );
}

function LinkView({
  context,
  detail,
  userOptions,
  memberId,
  actions,
  tr,
}: {
  context: ModulePageContext;
  detail: AdminGroupDetail;
  userOptions: AdminUserOption[];
  memberId: string;
  actions: OweNoGroupsActions;
  tr: (text: string, params?: Record<string, string | number>) => string;
}) {
  const member = detail.members.find((candidate) => candidate.id === memberId);
  const linked = new Set(
    detail.members.map((row) => row.user_id).filter((id): id is string => id !== null),
  );
  return (
    <>
      <PageHeader
        title={tr("Link account")}
        description={member ? member.display_name : detail.group.name}
        backHref={href(detail.group.id)}
        backLabel={detail.group.name}
        anchor={anchorOf(context)}
        tr={tr}
      />
      <section className="max-w-xl rounded-card border border-border bg-surface p-4">
        {member ? (
                    <form action={actions.linkMember} className="flex flex-col gap-3">
            <input type="hidden" name="group" value={detail.group.id} />
            <input type="hidden" name="member" value={member.id} />
            <Field label={tr("Account")}>
              <select name="user_id" required defaultValue="" className={`${control} font-normal`}>
                <option value="">{tr("Choose an account")}</option>
                {userOptions.map((option) => (
                  <option key={option.id} value={option.id} disabled={linked.has(option.id)}>
                    {option.display_name}
                    {linked.has(option.id) ? ` · ${tr("Already in the group")}` : ""}
                  </option>
                ))}
              </select>
            </Field>
            <p className="text-[11px] text-muted-foreground">
              {tr("Accounts already in the group are disabled: each account can belong to one member.")}
            </p>
                      <div className="flex flex-wrap items-center justify-end gap-3">
              <a href={href(detail.group.id)} className={link}>
                {tr("Cancel")}
              </a>
              <button type="submit" className={primary}>
                {tr("Link")}
              </button>
            </div>
          </form>
        ) : (
          <p className="text-xs text-muted-foreground">{tr("That member already has an account.")}</p>
        )}
      </section>
    </>
  );
}

/**
 * Filters for the movement list. A plain GET form: the panel is a server
 * component, so the browser reloads with the query and the API does the work.
 */
function MovementFilters({
  context,
  detail,
  tr,
}: {
  context: ModulePageContext;
  detail: AdminGroupDetail;
  tr: (text: string, params?: Record<string, string | number>) => string;
}) {
  const value = (key: string) => {
    const raw = context.searchParams[key];
    return typeof raw === "string" ? raw : "";
  };
  const field =
    "min-h-11 rounded-control border border-border bg-background px-2 text-xs text-foreground";
  const anchor = anchorOf(context);
  const AnchorTag = anchor;

  return (
    <form method="get" className="mb-3 flex flex-wrap items-end gap-2">
      <input type="hidden" name="group" value={detail.group.id} />
      <label className="flex flex-col gap-1 text-[11px] text-muted-foreground">
        {tr("Type")}
        <select name="kind" defaultValue={value("kind")} className={field}>
          <option value="">{tr("All")}</option>
          <option value="expense">{tr("Expense")}</option>
          <option value="settlement">{tr("Settlement")}</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-[11px] text-muted-foreground">
        {tr("Member")}
        <select name="member" defaultValue={value("member")} className={field}>
          <option value="">{tr("All")}</option>
          {detail.members.map((member) => (
            <option key={member.id} value={member.id}>
              {member.display_name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-[11px] text-muted-foreground">
        {tr("Category")}
        <select name="category" defaultValue={value("category")} className={field}>
          <option value="">{tr("All")}</option>
          {detail.categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-[11px] text-muted-foreground">
        {tr("From")}
        <input type="date" name="from" defaultValue={value("from")} className={field} />
      </label>
      <label className="flex flex-col gap-1 text-[11px] text-muted-foreground">
        {tr("To")}
        <input type="date" name="to" defaultValue={value("to")} className={field} />
      </label>
      <label className="flex min-w-40 flex-1 flex-col gap-1 text-[11px] text-muted-foreground">
        {tr("Search description")}
        <input
          type="search"
          name="mq"
          defaultValue={value("mq")}
          placeholder={tr("Description")}
          className={field}
        />
      </label>
      <button type="submit" className={secondary}>
        {tr("Filter")}
      </button>
      <AnchorTag href={href(detail.group.id)} className={link}>
        {tr("Clear")}
      </AnchorTag>
    </form>
  );
}

/** Previous/next plus the page count; links keep the active filters. */
function MovementPager({
  context,
  detail,
  tr,
}: {
  context: ModulePageContext;
  detail: AdminGroupDetail;
  tr: (text: string, params?: Record<string, string | number>) => string;
}) {
  const pages = Math.max(1, Math.ceil(detail.movements_total / detail.movements_per_page));
  if (pages <= 1) return null;
  const current = detail.movements_page;
  const base = new URLSearchParams();
  for (const [key, value] of Object.entries(context.searchParams)) {
    if (typeof value !== "string" || value === "" || key === "page") continue;
    base.set(key, value);
  }
  const pageHref = (page: number) => {
    const params = new URLSearchParams(base);
    params.set("page", String(page));
    return `?${params.toString()}`;
  };
  const AnchorTag = anchorOf(context);

  return (
    <nav className="mt-3 flex items-center justify-between gap-2 text-xs" aria-label={tr("Movements")}>
      {current > 1 ? (
        <AnchorTag href={pageHref(current - 1)} className={secondary}>
          {tr("Previous")}
        </AnchorTag>
      ) : (
        <span />
      )}
      <span className="text-[11px] text-muted-foreground tabular-nums">
        {tr("Page {page} of {pages}", { page: current, pages })}
      </span>
      {current < pages ? (
        <AnchorTag href={pageHref(current + 1)} className={secondary}>
          {tr("Next")}
        </AnchorTag>
      ) : (
        <span />
      )}
    </nav>
  );
}

/** The last six months of a group, oldest first. */
function monthLabel(month: string, locale: string): string {
  const [year, index] = month.split("-").map(Number);
  if (!year || !index) return month;
  return new Intl.DateTimeFormat(locale, { month: "short" }).format(
    new Date(Date.UTC(year, index - 1, 1)),
  );
}

function dayLabel(value: string, locale: string): string {
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function fullMonthLabel(month: string, locale: string): string {
  const [year, index] = month.split("-").map(Number);
  if (!year || !index) return month;
  return new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(
    new Date(Date.UTC(year, index - 1, 1)),
  );
}

/**
 * The group at a glance, exactly like the app's Summary tab: this month's
 * total and its change, who paid versus who consumed this month, where this
 * month's money went, and the last six months. The lifetime totals stay in the
 * header, labelled as history, so they never read as this month's spending.
 */
function GroupSummary({
  context,
  detail,
  tr,
}: {
  context: ModulePageContext;
  detail: AdminGroupDetail;
  tr: (text: string, params?: Record<string, string | number>) => string;
}) {
  const { group } = detail;
  const max = Math.max(1, ...detail.category_totals.map((entry) => entry.total));
  const monthMax = Math.max(1, ...detail.months.map((entry) => entry.total));
  const currentMonth = new Date().toISOString().slice(0, 7);
  const delta =
    detail.previous_month_total > 0
      ? Math.round(
          ((detail.month_total - detail.previous_month_total) / detail.previous_month_total) * 100,
        )
      : null;

  return (
    <section className="flex max-w-3xl flex-col gap-3 rounded-card border border-border bg-surface p-3">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {tr("Summary")}
      </h2>

      <div className="rounded-card border border-accent/40 bg-accent/5 p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {tr("This month")}
        </p>
        <p className="text-3xl font-bold tabular-nums">
          {money(detail.month_total, group.currency, context.locale)}
        </p>
        {delta !== null ? (
          <p className="text-xs text-muted-foreground">
            <span className={delta > 0 ? "font-semibold text-destructive" : "font-semibold text-success"}>
              {delta > 0 ? "↑" : "↓"} {Math.abs(delta)} %
            </span>{" "}
            {tr("vs last month")}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">{tr("First month")}</p>
        )}
      </div>

      <h3 className="text-xs font-semibold">{tr("People")}</h3>
      {detail.people_totals.length === 0 ? (
        <p className="text-xs text-muted-foreground">{tr("No movements this month.")}</p>
      ) : (
        <ul className="flex flex-col gap-1 text-xs">
          {detail.people_totals.map((person) => (
            <li key={person.name} className="flex flex-wrap items-center justify-between gap-2">
              <span className="truncate font-semibold">{person.name}</span>
              <span className="tabular-nums text-muted-foreground">
                {tr("Paid")} {money(person.paid, group.currency, context.locale)} ·{" "}
                {tr("Consumed")} {money(person.consumed, group.currency, context.locale)}
              </span>
            </li>
          ))}
        </ul>
      )}

      <h3 className="text-xs font-semibold">
        {tr("By category")} · {fullMonthLabel(currentMonth, context.locale)}
      </h3>
      <p className="text-[11px] text-muted-foreground">
        {tr("Only categories with expenses this month are listed.")}
      </p>
      {detail.category_totals.length === 0 ? (
        <p className="text-xs text-muted-foreground">{tr("No movements this month.")}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {detail.category_totals.map((entry) => (
            <li key={entry.name || "none"} className="flex flex-col gap-1">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="truncate">{entry.name || tr("No category")}</span>
                <span className="whitespace-nowrap tabular-nums text-muted-foreground">
                  {money(entry.total, group.currency, context.locale)} ·{" "}
                  {Math.round((entry.total / Math.max(1, detail.month_total)) * 100)}%
                </span>
              </div>
              <div className="h-2 rounded-full bg-muted">
                <div
                  className="h-2 rounded-full bg-accent"
                  style={{
                    width: `${Math.max(2, Math.round((entry.total / max) * 100))}%`,
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}

      <h3 className="text-xs font-semibold">{tr("Evolution")}</h3>
      <ul className="flex items-end gap-2">
        {detail.months.map((entry) => {
          const breakdown = entry.categories
            .map(
              (category) =>
                `${category.name || tr("No category")} ${Math.round(
                  (category.total / Math.max(1, entry.total)) * 100,
                )}%`,
            )
            .join(", ");
          return (
            <li
              key={entry.month}
              tabIndex={0}
              aria-label={`${fullMonthLabel(entry.month, context.locale)}: ${
                breakdown || tr("No movements this month.")
              }`}
              className="group relative flex flex-1 flex-col items-center gap-1 rounded-control outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <span className="text-[10px] tabular-nums text-muted-foreground">
                {money(entry.total, group.currency, context.locale)}
              </span>
              <div className="flex h-24 w-full items-end rounded-t bg-muted">
                <div
                  className="w-full rounded-t bg-accent"
                  style={{ height: `${Math.max(2, Math.round((entry.total / monthMax) * 100))}%` }}
                />
              </div>
              <span className="text-[10px] text-muted-foreground">
                {monthLabel(entry.month, context.locale)}
              </span>
              <div className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 hidden w-52 -translate-x-1/2 rounded-control border border-border bg-surface p-2 text-left text-[11px] shadow-xl group-hover:block group-focus:block">
                <p className="mb-1 font-semibold">
                  {fullMonthLabel(entry.month, context.locale)}
                </p>
                {entry.categories.length === 0 ? (
                  <p className="text-muted-foreground">{tr("No movements this month.")}</p>
                ) : (
                  <ul className="flex flex-col gap-0.5">
                    {entry.categories.map((category) => (
                      <li key={category.name || "none"} className="flex items-center justify-between gap-3">
                        <span className="truncate">{category.name || tr("No category")}</span>
                        <span className="tabular-nums text-muted-foreground">
                          {Math.round(
                            (category.total / Math.max(1, entry.total)) * 100,
                          )}
                          %
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <p className="text-[11px] text-muted-foreground">
        {tr("Group history: {expenses} in expenses and {payments} in payments since {date}.", {
          expenses: money(detail.expenses_total, group.currency, context.locale),
          payments: money(detail.payments_total, group.currency, context.locale),
          date: detail.first_movement_on
            ? dayLabel(detail.first_movement_on, context.locale)
            : "—",
        })}
      </p>
    </section>
  );
}
