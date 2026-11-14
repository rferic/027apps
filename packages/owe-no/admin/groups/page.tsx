import { t } from "@027apps/i18n/t.js";
import type { ModulePageContext } from "@027apps/core/modules/pages.js";
import type {
  AdminGroupDetail,
  AdminGroupView,
  AdminUserOption,
} from "../../src/admin";
import type { MovementView } from "../../src/service";
import type { SettlementPlan } from "../../src/settlement";

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
}

const ERROR_KEYS: Record<string, string> = {
  member_has_balance: "That member still has a balance. Settle it first.",
  member_exists: "That account is already in the group.",
  member_linked: "That member already has an account.",
  group_archived: "The group is archived. Reopen it to make changes.",
  kind_immutable: "A movement cannot change between expense and settlement.",
  validation_failed: "Check the values and try again.",
  forbidden: "You do not have permission to do that.",
  failed: "Something went wrong. Try again.",
};

const today = () => new Date().toISOString().slice(0, 10);

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

function cents(raw: string): number | null {
  const value = Math.round(Number(raw.replace(",", ".")) * 100);
  return Number.isFinite(value) && value > 0 ? value : null;
}

/**
 * OweNo groups in the panel (D26): the list, one group with its balances,
 * members and movements, and the forms that write. The page is presentational:
 * every write arrives as a Server Action from the app wrapper, so the package
 * never depends on Next, and the panel gate lives in the action.
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
  const editId = typeof context.searchParams.edit === "string" ? context.searchParams.edit : "";

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
        <GroupDetail
          context={context}
          detail={detail}
          userOptions={userOptions}
          plan={plan}
          actions={actions}
          editId={editId}
          tr={tr}
        />
      ) : (
        <GroupList context={context} groups={groups} actions={actions} tr={tr} />
      )}
    </section>
  );
}

function GroupList({
  context,
  groups,
  actions,
  tr,
}: {
  context: ModulePageContext;
  groups: AdminGroupView[];
  actions: OweNoGroupsActions;
  tr: (text: string, params?: Record<string, string | number>) => string;
}) {
  return (
    <>
      <header className="flex flex-col gap-1">
        <h1 className="text-base font-bold">{tr("Groups")}</h1>
        <p className="text-xs text-muted-foreground">
          {tr(
            "Every group, with its members and movements. Members manage their own movements from the app; the panel does not record money.",
          )}
        </p>
      </header>

      <details className="rounded-card border border-border bg-surface p-3">
        <summary className="cursor-pointer text-xs font-semibold">{tr("New group")}</summary>
        <form action={actions.createGroup} className="mt-3 flex flex-wrap items-end gap-2">
          <label className="flex min-w-48 flex-1 flex-col gap-1 text-xs">
            <span className="text-muted-foreground">{tr("Group name")}</span>
            <input
              name="name"
              required
              maxLength={80}
              className="min-h-9 rounded-control border border-border bg-background px-2 text-foreground"
            />
          </label>
          <label className="flex w-24 flex-col gap-1 text-xs">
            <span className="text-muted-foreground">{tr("Currency")}</span>
            <input
              name="currency"
              defaultValue="EUR"
              maxLength={3}
              required
              className="min-h-9 rounded-control border border-border bg-background px-2 font-mono uppercase text-foreground"
            />
          </label>
          <button type="submit" className="min-h-9 rounded-control bg-accent px-3 text-xs font-semibold text-accent-foreground">
            {tr("Create")}
          </button>
        </form>
      </details>

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
                    <a
                      href={`?group=${encodeURIComponent(group.id)}`}
                      className="font-semibold text-accent hover:underline"
                    >
                      {group.name}
                    </a>
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
      <p className="text-[11px] text-muted-foreground">
        {context.locale ? tr("The panel writes as an administrator; every change is recorded.") : null}
      </p>
    </>
  );
}

function GroupDetail({
  context,
  detail,
  userOptions,
  plan,
  actions,
  editId,
  tr,
}: {
  context: ModulePageContext;
  detail: AdminGroupDetail;
  userOptions: AdminUserOption[];
  plan: SettlementPlan | null;
  actions: OweNoGroupsActions;
  editId: string;
  tr: (text: string, params?: Record<string, string | number>) => string;
}) {
  const { group, members, movements } = detail;
  const currency = group.currency;
  const locale = context.locale;
  const editing = editId ? movements.find((movement) => movement.id === editId) : undefined;

  return (
    <>
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <a href="?" className="text-xs text-muted-foreground hover:underline">
              ← {tr("Groups")}
            </a>
            <h1 className="text-base font-bold">{group.name}</h1>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
              {group.archived ? tr("Archived") : tr("Active")} · {currency}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            {tr("{members} members · {movements} movements", {
              members: group.members,
              movements: group.movements,
            })}
          </p>
        </div>
        <form action={actions.archiveGroup}>
          <input type="hidden" name="group" value={group.id} />
          <input type="hidden" name="archived" value={group.archived ? "false" : "true"} />
          <button
            type="submit"
            className="min-h-9 rounded-control border border-border px-3 text-xs font-semibold hover:bg-muted"
          >
            {group.archived ? tr("Reopen group") : tr("Archive group")}
          </button>
        </form>
      </header>

      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {members
          .filter((member) => member.state === "active")
          .map((member) => (
            <div key={member.id} className="rounded-card border border-border bg-surface p-3">
              <dt className="truncate text-xs text-muted-foreground">{member.display_name}</dt>
              <dd
                className={`text-lg font-bold tabular-nums ${
                  member.balance > 0 ? "text-success" : member.balance < 0 ? "text-destructive" : ""
                }`}
              >
                {money(member.balance, currency, locale)}
              </dd>
            </div>
          ))}
      </dl>

      <Members
        groupId={group.id}
        members={members}
        userOptions={userOptions}
        actions={actions}
        currency={currency}
        locale={locale}
        archived={group.archived}
        tr={tr}
      />

      <Movements
        context={context}
        detail={detail}
        actions={actions}
        tr={tr}
      />

      <MovementForm
        groupId={group.id}
        members={members.filter((member) => member.state === "active")}
        currency={currency}
        editing={editing}
        actions={actions}
        tr={tr}
        archived={group.archived}
      />

      <Settlement
        groupId={group.id}
        members={members.filter((member) => member.state === "active")}
        currency={currency}
        locale={locale}
        plan={plan}
        actions={actions}
        tr={tr}
        archived={group.archived}
      />
    </>
  );
}

function Members({
  groupId,
  members,
  userOptions,
  actions,
  currency,
  locale,
  archived,
  tr,
}: {
  groupId: string;
  members: AdminGroupDetail["members"];
  userOptions: AdminUserOption[];
  actions: OweNoGroupsActions;
  currency: string;
  locale: string;
  archived: boolean;
  tr: (text: string, params?: Record<string, string | number>) => string;
}) {
  return (
    <section className="rounded-card border border-border bg-surface p-3">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {tr("Members")}
      </h2>
      <ul className="flex flex-col divide-y divide-border">
        {members.map((member) => (
          <li key={member.id} className="flex flex-wrap items-center gap-2 py-2 text-xs">
            <span className="font-semibold">{member.display_name}</span>
            <span className="text-[11px] text-muted-foreground">
              {member.user_id ? tr("Linked account") : tr("Fictitious member")} ·{" "}
              {member.state === "active" ? tr("Active") : member.state}
            </span>
            <span
              className={`ml-auto tabular-nums ${
                member.balance > 0 ? "text-success" : member.balance < 0 ? "text-destructive" : "text-muted-foreground"
              }`}
            >
              {money(member.balance, currency, locale)}
            </span>
            {!archived ? (
              <>
                {!member.user_id ? (
                  <form action={actions.linkMember} className="flex items-center gap-1">
                    <input type="hidden" name="group" value={groupId} />
                    <input type="hidden" name="member" value={member.id} />
                    <select
                      name="user_id"
                      required
                      aria-label={tr("Link account")}
                      className="min-h-8 rounded-control border border-border bg-background px-1 text-[11px]"
                    >
                      <option value="">{tr("Link account")}</option>
                      {userOptions.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.display_name}
                        </option>
                      ))}
                    </select>
                    <button type="submit" className="min-h-8 rounded-control border border-border px-2 text-[11px] font-semibold">
                      {tr("Link")}
                    </button>
                  </form>
                ) : null}
                {member.state === "active" ? (
                  <form action={actions.removeMember}>
                    <input type="hidden" name="group" value={groupId} />
                    <input type="hidden" name="member" value={member.id} />
                    <button
                      type="submit"
                      title={tr("A member with a balance cannot be removed.")}
                      className="min-h-8 rounded-control border border-border px-2 text-[11px] font-semibold text-destructive"
                    >
                      {tr("Remove")}
                    </button>
                  </form>
                ) : null}
              </>
            ) : null}
          </li>
        ))}
      </ul>

      {!archived ? (
        <form action={actions.addMember} className="mt-3 flex flex-wrap items-end gap-2">
          <input type="hidden" name="group" value={groupId} />
          <label className="flex min-w-40 flex-1 flex-col gap-1 text-xs">
            <span className="text-muted-foreground">{tr("Name")}</span>
            <input
              name="display_name"
              required
              maxLength={80}
              className="min-h-9 rounded-control border border-border bg-background px-2"
            />
          </label>
          <label className="flex min-w-40 flex-col gap-1 text-xs">
            <span className="text-muted-foreground">{tr("Account (optional)")}</span>
            <select
              name="user_id"
              className="min-h-9 rounded-control border border-border bg-background px-2"
            >
              <option value="">{tr("No account")}</option>
              {userOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.display_name}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="min-h-9 rounded-control bg-accent px-3 text-xs font-semibold text-accent-foreground">
            {tr("Add member")}
          </button>
        </form>
      ) : null}
    </section>
  );
}

function Movements({
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
  const { group, members, movements } = detail;
  const byId = new Map(members.map((member) => [member.id, member.display_name]));

  return (
    <section className="rounded-card border border-border bg-surface p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {tr("Movements")}
        </h2>
        {!group.archived ? (
          <a href="?group=#movement-form" className="text-[11px] font-semibold text-accent hover:underline">
            {tr("Add expense")}
          </a>
        ) : null}
      </div>

      {movements.length === 0 ? (
        <p className="text-xs text-muted-foreground">{tr("No movements yet.")}</p>
      ) : (
        <div className="overflow-x-auto">
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
                  <td className="border-b border-border p-2 whitespace-nowrap">{movement.occurred_on}</td>
                  <td className="border-b border-border p-2">
                    <span className="font-semibold">{movement.description}</span>
                    <span className="ml-2 text-[11px] text-muted-foreground">
                      {movement.kind === "settlement" ? tr("Settlement") : tr("Expense")}
                    </span>
                  </td>
                  <td className="border-b border-border p-2">{byId.get(movement.paid_by) ?? ""}</td>
                  <td className="border-b border-border p-2 text-right tabular-nums">
                    {money(movement.amount_minor, movement.currency, context.locale)}
                  </td>
                  <td className="border-b border-border p-2 text-right">
                    {!group.archived ? (
                      <span className="inline-flex items-center gap-1">
                        <a
                          href={`?group=${encodeURIComponent(group.id)}&edit=${encodeURIComponent(movement.id)}`}
                          className="rounded-control border border-border px-2 py-1 text-[11px] font-semibold"
                        >
                          {tr("Edit")}
                        </a>
                        <form action={actions.deleteMovement}>
                          <input type="hidden" name="group" value={group.id} />
                          <input type="hidden" name="movement" value={movement.id} />
                          <button
                            type="submit"
                            className="rounded-control border border-border px-2 py-1 text-[11px] font-semibold text-destructive"
                          >
                            {tr("Delete")}
                          </button>
                        </form>
                      </span>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function MovementForm({
  groupId,
  members,
  currency,
  editing,
  actions,
  tr,
  archived,
}: {
  groupId: string;
  members: AdminGroupDetail["members"];
  currency: string;
  editing?: MovementView;
  actions: OweNoGroupsActions;
  tr: (text: string, params?: Record<string, string | number>) => string;
  archived: boolean;
}) {
  if (archived) return null;
  const shareOf = (memberId: string) =>
    editing?.shares.find((share) => share.memberId === memberId)?.amount_minor;
  const equal = editing ? Math.round(editing.amount_minor / Math.max(editing.shares.length, 1)) : null;
  const exact = editing ? editing.shares.some((share) => share.amount_minor !== equal) : false;

  return (
    <details
      id="movement-form"
      open={Boolean(editing)}
      className="rounded-card border border-border bg-surface p-3"
    >
      <summary className="cursor-pointer text-xs font-semibold">
        {editing ? tr("Edit expense") : tr("Add expense")}
      </summary>
      <form action={actions.saveMovement} className="mt-3 flex flex-col gap-3">
        <input type="hidden" name="group" value={groupId} />
        {editing ? <input type="hidden" name="movement" value={editing.id} /> : null}
        <input type="hidden" name="kind" value={editing?.kind ?? "expense"} />
        <div className="flex flex-wrap gap-2">
          <label className="flex min-w-48 flex-1 flex-col gap-1 text-xs">
            <span className="text-muted-foreground">{tr("Description")}</span>
            <input
              name="description"
              required
              maxLength={200}
              defaultValue={editing?.description ?? ""}
              className="min-h-9 rounded-control border border-border bg-background px-2"
            />
          </label>
          <label className="flex w-28 flex-col gap-1 text-xs">
            <span className="text-muted-foreground">{tr("Amount")} ({currency})</span>
            <input
              name="amount"
              required
              inputMode="decimal"
              defaultValue={editing ? (editing.amount_minor / 100).toFixed(2) : ""}
              className="min-h-9 rounded-control border border-border bg-background px-2 text-right tabular-nums"
            />
          </label>
          <label className="flex w-36 flex-col gap-1 text-xs">
            <span className="text-muted-foreground">{tr("Date")}</span>
            <input
              type="date"
              name="occurred_on"
              required
              defaultValue={editing?.occurred_on ?? today()}
              className="min-h-9 rounded-control border border-border bg-background px-2"
            />
          </label>
          <label className="flex w-40 flex-col gap-1 text-xs">
            <span className="text-muted-foreground">{tr("Paid by")}</span>
            <select
              name="paid_by"
              required
              defaultValue={editing?.paid_by ?? members[0]?.id ?? ""}
              className="min-h-9 rounded-control border border-border bg-background px-2"
            >
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.display_name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex w-32 flex-col gap-1 text-xs">
            <span className="text-muted-foreground">{tr("Split")}</span>
            <select
              name="mode"
              defaultValue={exact ? "exact" : "equal"}
              className="min-h-9 rounded-control border border-border bg-background px-2"
            >
              <option value="equal">{tr("Equal parts")}</option>
              <option value="exact">{tr("Exact amounts")}</option>
            </select>
          </label>
        </div>

        <fieldset className="flex flex-col gap-1 rounded-control border border-border p-2">
          <legend className="px-1 text-[11px] text-muted-foreground">{tr("Participants")}</legend>
          {members.map((member) => {
            const selected =
              editing?.shares.some((share) => share.memberId === member.id) ?? true;
            const amount = shareOf(member.id);
            return (
              <label key={member.id} className="flex items-center gap-2 text-xs">
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
                  placeholder={tr("Exact")}
                  defaultValue={amount === undefined ? "" : (amount / 100).toFixed(2)}
                  className="ml-auto min-h-8 w-24 rounded-control border border-border bg-background px-2 text-right text-[11px] tabular-nums"
                />
              </label>
            );
          })}
          <span className="text-[10px] text-muted-foreground">
            {tr("Amounts are only used in exact mode; the rest splits equally.")}
          </span>
        </fieldset>

        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            className="min-h-9 rounded-control bg-accent px-3 text-xs font-semibold text-accent-foreground"
          >
            {editing ? tr("Save changes") : tr("Save expense")}
          </button>
          {editing ? (
            <a href={`?group=${encodeURIComponent(groupId)}`} className="min-h-9 rounded-control border border-border px-3 text-xs font-semibold leading-9">
              {tr("Cancel")}
            </a>
          ) : null}
        </div>
      </form>
    </details>
  );
}

function Settlement({
  groupId,
  members,
  currency,
  locale,
  plan,
  actions,
  tr,
  archived,
}: {
  groupId: string;
  members: AdminGroupDetail["members"];
  currency: string;
  locale: string;
  plan: SettlementPlan | null;
  actions: OweNoGroupsActions;
  tr: (text: string, params?: Record<string, string | number>) => string;
  archived: boolean;
}) {
  if (archived || members.length < 2) return null;
  const byId = new Map(members.map((member) => [member.id, member.display_name]));
  return (
    <details className="rounded-card border border-border bg-surface p-3">
      <summary className="cursor-pointer text-xs font-semibold">{tr("Settle up")}</summary>
      <p className="mt-2 text-[11px] text-muted-foreground">
        {tr("Each payment is recorded as a settlement movement.")}
      </p>
      {plan && plan.transfers.length > 0 ? (
        <ul className="mt-2 flex flex-col divide-y divide-border rounded-control border border-border">
          {plan.transfers.map((transfer) => (
            <li
              key={`${transfer.from}-${transfer.to}`}
              className="flex flex-wrap items-center gap-2 p-2 text-xs"
            >
              <span className="font-semibold">{byId.get(transfer.from) ?? transfer.from}</span>
              <span aria-hidden="true">→</span>
              <span className="font-semibold">{byId.get(transfer.to) ?? transfer.to}</span>
              <span className="ml-auto tabular-nums">
                {money(transfer.amount_minor, currency, locale)}
              </span>
              <form action={actions.settle}>
                <input type="hidden" name="group" value={groupId} />
                <input type="hidden" name="from" value={transfer.from} />
                <input type="hidden" name="to" value={transfer.to} />
                <input type="hidden" name="amount" value={(transfer.amount_minor / 100).toFixed(2)} />
                <input type="hidden" name="occurred_on" value={today()} />
                <input type="hidden" name="description" value="Settlement" />
                <button
                  type="submit"
                  className="min-h-8 rounded-control bg-accent px-2 text-[11px] font-semibold text-accent-foreground"
                >
                  {tr("Register payment")}
                </button>
              </form>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-[11px] text-muted-foreground">{tr("Everyone is settled.")}</p>
      )}
      <form action={actions.settle} className="mt-3 flex flex-wrap items-end gap-2">
        <input type="hidden" name="group" value={groupId} />
        <input type="hidden" name="occurred_on" value={today()} />
        <label className="flex w-36 flex-col gap-1 text-xs">
          <span className="text-muted-foreground">{tr("Who pays")}</span>
          <select name="from" required className="min-h-9 rounded-control border border-border bg-background px-2">
            {members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.display_name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex w-36 flex-col gap-1 text-xs">
          <span className="text-muted-foreground">{tr("Who receives")}</span>
          <select name="to" required className="min-h-9 rounded-control border border-border bg-background px-2">
            {members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.display_name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex w-28 flex-col gap-1 text-xs">
          <span className="text-muted-foreground">{tr("Amount")} ({currency})</span>
          <input
            name="amount"
            required
            inputMode="decimal"
            className="min-h-9 rounded-control border border-border bg-background px-2 text-right tabular-nums"
          />
        </label>
        <input type="hidden" name="description" value="Settlement" />
        <button type="submit" className="min-h-9 rounded-control bg-accent px-3 text-xs font-semibold text-accent-foreground">
          {tr("Register payment")}
        </button>
      </form>
      <p className="mt-2 text-[10px] text-muted-foreground">
        {tr("The suggestion is computed from the current balances of the group.")}
      </p>
    </details>
  );
}
