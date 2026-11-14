import { t } from "@027apps/i18n/t.js";
import type { ModulePageContext } from "@027apps/core/modules/pages.js";
import type {
  AdminGroupDetail,
  AdminGroupView,
  AdminUserOption,
} from "../../src/admin";
import type { MovementView } from "../../src/service";
import type { SettlementPlan } from "../../src/settlement";
import { ConfirmForm } from "../components/confirm-form";

type Action = (formData: FormData) => Promise<void>;

export interface OweNoGroupsActions {
  createGroup: Action;
  archiveGroup: Action;
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
}: {
  context: ModulePageContext;
  groups: AdminGroupView[];
  detail: AdminGroupDetail | null;
  userOptions: AdminUserOption[];
  plan: SettlementPlan | null;
  actions: OweNoGroupsActions;
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
          <GroupDetail context={context} detail={detail} actions={actions} tr={tr} />
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
            <input name="name" required maxLength={80} className={`${control} font-normal`} />
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
  tr,
}: {
  context: ModulePageContext;
  detail: AdminGroupDetail;
  actions: OweNoGroupsActions;
  tr: (text: string, params?: Record<string, string | number>) => string;
}) {
  const AnchorTag = anchorOf(context);
  const { group, members, movements } = detail;
  const active = members.filter((member) => member.state === "active");
  const byId = new Map(members.map((member) => [member.id, member.display_name]));

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
        description={tr("Members {members} · Movements {movements}", {
          members: group.members,
          movements: group.movements,
        })}
        tr={tr}
      >
        <div className="flex w-full flex-col gap-2 sm:w-auto">
          {!group.archived ? (
            <AnchorTag href={href(group.id, "movement")} className={`${primary} w-full sm:w-auto`}>
              {tr("Add expense")}
            </AnchorTag>
          ) : null}
          <div className={group.archived ? "" : "grid grid-cols-2 gap-2 sm:flex"}>
            {!group.archived ? (
              <AnchorTag href={href(group.id, "settle")} className={secondary}>
                {tr("Settle up")}
              </AnchorTag>
            ) : null}
            <div>
              <ConfirmForm
                action={actions.archiveGroup}
                fields={{ group: group.id, archived: group.archived ? "false" : "true" }}
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
                className="w-full"
              />
            </div>
          </div>
        </div>
      </PageHeader>

      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
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
                    fields={{ group: group.id, member: member.id }}
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

      <section className="rounded-card border border-border bg-surface p-3">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {tr("Movements")}
        </h2>
        {group.movements > movements.length ? (
          <p className="mb-2 text-[11px] text-muted-foreground">
            {tr("Showing the latest {shown} of {total} movements.", {
              shown: movements.length,
              total: group.movements,
            })}
          </p>
        ) : null}
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
                            fields={{ group: group.id, movement: movement.id }}
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
      </section>
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
          {editing ? <input type="hidden" name="movement" value={editing.id} /> : null}
          <input type="hidden" name="kind" value={editing?.kind ?? "expense"} />
          <div className="flex flex-wrap gap-2">
            <Field label={tr("Description")} wide>
              <input
                name="description"
                required
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
            <input name="display_name" required maxLength={80} className={`${control} font-normal`} />
          </Field>
          <Field label={tr("Account (optional)")}>
            <select name="user_id" className={`${control} font-normal`}>
              <option value="">{tr("No account")}</option>
              {userOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.display_name}
                </option>
              ))}
            </select>
          </Field>
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
            <Field label={tr("Account (optional)")}>
              <select name="user_id" required className={`${control} font-normal`}>
                <option value="">{tr("Link account")}</option>
                {userOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.display_name}
                  </option>
                ))}
              </select>
            </Field>
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
