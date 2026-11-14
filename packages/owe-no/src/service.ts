import { computeBalances, nonZeroBalances } from "./balances";
import { splitEqual } from "./money";
import { validateMovement } from "./movements";
import { settle, type SettlementPlan } from "./settlement";

export interface OweDb {
  query(sql: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
}

export interface OweDeps {
  db: OweDb;
  withTransaction?: <T>(fn: (db: OweDb) => Promise<T>) => Promise<T>;
}

export type OweError =
  | "not_found"
  | "forbidden"
  | "validation_failed"
  | "conflict";

export class OweDomainError extends Error {
  constructor(
    readonly code: OweError,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "OweDomainError";
  }
}

export interface GroupView {
  id: string;
  name: string;
  currency: string;
  archived: boolean;
  created_by: string | null;
  members: number;
  role: "invited" | "active" | "left" | "removed";
}

export interface MemberView {
  id: string;
  display_name: string;
  state: "invited" | "active" | "left" | "removed";
  user_id: string | null;
  /** Registered (linked to an account) or fictitious. */
  kind: "user" | "fictitious";
}

interface MemberRow {
  id: string;
  group_id: string;
  user_id: string | null;
  display_name: string;
  state: "invited" | "active" | "left" | "removed";
}

const key = (groupId: string) => groupId;

async function memberFor(
  deps: OweDeps,
  userId: string,
  groupId: string,
): Promise<MemberRow | null> {
  const { rows } = await deps.db.query(
    `select id, group_id, user_id, display_name, state
       from module_owe_no.owe_no_members
      where group_id = $1 and user_id = $2
      order by created_at asc limit 1`,
    [groupId, userId],
  );
  const row = rows[0];
  if (!row) return null;
  return {
    id: String(row.id),
    group_id: String(row.group_id),
    user_id: row.user_id === null ? null : String(row.user_id),
    display_name: String(row.display_name),
    state: row.state as MemberRow["state"],
  };
}

async function requireActiveMember(deps: OweDeps, userId: string, groupId: string) {
  const member = await memberFor(deps, userId, groupId);
  if (!member) throw new OweDomainError("not_found", "group not found");
  if (member.state !== "active") throw new OweDomainError("forbidden", "member is not active");
  return member;
}

async function requireCreator(deps: OweDeps, userId: string, groupId: string) {
  const member = await requireActiveMember(deps, userId, groupId);
  const { rows } = await deps.db.query(
    "select created_by from module_owe_no.owe_no_groups where id = $1",
    [groupId],
  );
  if (rows[0]?.created_by !== userId) throw new OweDomainError("forbidden", "only the creator");
  return member;
}

export async function createGroup(
  deps: OweDeps,
  userId: string,
  input: { name: string; currency: string },
): Promise<GroupView> {
  const name = input.name.trim();
  if (name.length === 0) throw new OweDomainError("validation_failed", "name is required");
  if (!/^[A-Z]{3}$/.test(input.currency)) {
    throw new OweDomainError("validation_failed", "currency must be an ISO 4217 code");
  }
  const run = deps.withTransaction ?? ((fn: (db: OweDb) => Promise<GroupView>) => fn(deps.db));
  return run(async (db) => {
    const scoped: OweDeps = { ...deps, db };
    const { rows: profile } = await db.query(
      "select display_name from public.profiles where id = $1",
      [userId],
    );
    const displayName = String(profile[0]?.display_name ?? "");
    const { rows: group } = await db.query(
      `insert into module_owe_no.owe_no_groups (name, currency, created_by)
       values ($1, $2, $3) returning id, name, currency, archived_at, created_by`,
      [name, input.currency, userId],
    );
    const id = String(group[0].id);
    await db.query(
      `insert into module_owe_no.owe_no_members
         (group_id, user_id, display_name, state, joined_at)
       values ($1, $2, $3, 'active', now())`,
      [id, userId, displayName],
    );
    return {
      id,
      name: String(group[0].name),
      currency: String(group[0].currency),
      archived: group[0].archived_at !== null,
      created_by: userId,
      members: 1,
      role: "active",
    };
    // `scoped` is intentionally unused: the transaction runner already passed
    // the write client, and every statement above uses it.
    void scoped;
  });
}

export async function listGroups(deps: OweDeps, userId: string): Promise<GroupView[]> {
  const { rows } = await deps.db.query(
    `select g.id, g.name, g.currency, g.archived_at, g.created_by, m.state,
            (select count(*)::int from module_owe_no.owe_no_members c
              where c.group_id = g.id and c.state = 'active') as members
       from module_owe_no.owe_no_groups g
       join module_owe_no.owe_no_members m on m.group_id = g.id and m.user_id = $1
      where m.state in ('invited', 'active') and g.archived_at is null
      order by g.created_at desc`,
    [userId],
  );
  return rows.map((row) => ({
    id: String(row.id),
    name: String(row.name),
    currency: String(row.currency),
    archived: row.archived_at !== null,
    created_by: row.created_by === null ? null : String(row.created_by),
    members: Number(row.members),
    role: row.state as GroupView["role"],
  }));
}

export async function listMembers(
  deps: OweDeps,
  userId: string,
  groupId: string,
): Promise<MemberView[]> {
  const member = await memberFor(deps, userId, groupId);
  if (!member) throw new OweDomainError("not_found", "group not found");
  const { rows } = await deps.db.query(
    `select id, display_name, state, user_id
       from module_owe_no.owe_no_members
      where group_id = $1 and state <> 'removed'
      order by display_name asc`,
    [key(groupId)],
  );
  return rows.map((row) => ({
    id: String(row.id),
    display_name: String(row.display_name),
    state: row.state as MemberView["state"],
    user_id: row.user_id === null ? null : String(row.user_id),
    kind: row.user_id === null ? "fictitious" : "user",
  }));
}

/** Invites a registered user or adds a fictitious member (creator only). */
export async function addMember(
  deps: OweDeps,
  userId: string,
  groupId: string,
  input: { displayName: string; inviteeId?: string },
): Promise<MemberView> {
  await requireCreator(deps, userId, groupId);
  const displayName = input.displayName.trim();
  if (displayName.length === 0) throw new OweDomainError("validation_failed", "name is required");
  if (input.inviteeId) {
    const { rows: profile } = await deps.db.query(
      "select display_name from public.profiles where id = $1 and deactivated_at is null",
      [input.inviteeId],
    );
    if (!profile[0]) throw new OweDomainError("validation_failed", "unknown user");
  }
  const { rows } = await deps.db.query(
    `insert into module_owe_no.owe_no_members
       (group_id, user_id, display_name, state, invited_by, invited_at)
     values ($1, $2, $3, 'invited', $4, now())
     on conflict (group_id, user_id) do update
       set state = 'invited', invited_at = now(), invited_by = $4
     returning id, display_name, state, user_id`,
    [groupId, input.inviteeId ?? null, displayName, userId],
  );
  const row = rows[0];
  return {
    id: String(row.id),
    display_name: String(row.display_name),
    state: row.state as MemberView["state"],
    user_id: row.user_id === null ? null : String(row.user_id),
    kind: row.user_id === null ? "fictitious" : "user",
  };
}

/** The invited member accepts: from `invited` to `active`. */
export async function acceptInvitation(
  deps: OweDeps,
  userId: string,
  groupId: string,
): Promise<void> {
  const member = await memberFor(deps, userId, groupId);
  if (!member) throw new OweDomainError("not_found", "invitation not found");
  if (member.state === "active") return;
  if (member.state !== "invited") throw new OweDomainError("forbidden", "member cannot join");
  await deps.db.query(
    `update module_owe_no.owe_no_members
        set state = 'active', joined_at = now()
      where id = $1`,
    [member.id],
  );
}

export interface MovementInput {
  kind: "expense" | "settlement";
  description: string;
  amount_minor: number;
  occurred_on: string;
  paid_by: string;
  category_id?: string | null;
  participants: Array<{ memberId: string; amount_minor?: number }>;
}

export interface MovementView {
  id: string;
  kind: "expense" | "settlement";
  description: string;
  amount_minor: number;
  currency: string;
  paid_by: string;
  occurred_on: string;
  category_id: string | null;
  shares: Array<{ memberId: string; amount_minor: number }>;
}

export async function addMovement(
  deps: OweDeps,
  userId: string,
  groupId: string,
  input: MovementInput,
): Promise<MovementView> {
  await requireActiveMember(deps, userId, groupId);
  const { rows: group } = await deps.db.query(
    "select currency from module_owe_no.owe_no_groups where id = $1 and archived_at is null",
    [groupId],
  );
  if (!group[0]) throw new OweDomainError("not_found", "group not found");
  const currency = String(group[0].currency);
  const groupMembers = await listMembers(deps, userId, groupId);
  const states = Object.fromEntries(
    groupMembers.map((member) => [member.id, member.state]),
  ) as Record<string, "invited" | "active" | "left" | "removed">;

  const shares =
    input.kind === "settlement"
      ? input.participants.map((participant) => ({
          memberId: participant.memberId,
          amount_minor: participant.amount_minor ?? input.amount_minor,
        }))
      : input.participants.some((participant) => participant.amount_minor !== undefined)
        ? input.participants.map((participant) => ({
            memberId: participant.memberId,
            amount_minor: participant.amount_minor ?? 0,
          }))
        : splitEqual(
            input.amount_minor,
            input.participants.map((participant) => participant.memberId),
          );

  validateMovement({
    kind: input.kind,
    amount_minor: input.amount_minor,
    paidBy: input.paid_by,
    participants: shares,
    memberStates: states,
  });

  const run = deps.withTransaction ?? ((fn: (db: OweDb) => Promise<MovementView>) => fn(deps.db));
  return run(async (db) => {
    const { rows } = await db.query(
      `insert into module_owe_no.owe_no_movements
         (group_id, kind, description, amount_minor, currency, paid_by_member_id,
          category_id, occurred_on, created_by)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       returning id`,
      [
        groupId,
        input.kind,
        input.description.trim(),
        input.amount_minor,
        currency,
        input.paid_by,
        input.category_id ?? null,
        input.occurred_on,
        userId,
      ],
    );
    const id = String(rows[0].id);
    for (const share of shares) {
      await db.query(
        `insert into module_owe_no.owe_no_movement_shares (movement_id, member_id, amount_minor)
         values ($1, $2, $3)`,
        [id, share.memberId, share.amount_minor],
      );
    }
    return {
      id,
      kind: input.kind,
      description: input.description.trim(),
      amount_minor: input.amount_minor,
      currency,
      paid_by: input.paid_by,
      occurred_on: input.occurred_on,
      category_id: input.category_id ?? null,
      shares,
    };
  });
}

export async function listMovements(
  deps: OweDeps,
  userId: string,
  groupId: string,
): Promise<MovementView[]> {
  await requireActiveMember(deps, userId, groupId);
  const { rows } = await deps.db.query(
    `select mv.id, mv.kind, mv.description, mv.amount_minor, mv.currency,
            mv.paid_by_member_id, mv.occurred_on, mv.category_id,
            coalesce(json_agg(json_build_object('memberId', s.member_id,
                                                'amount_minor', s.amount_minor))
                       filter (where s.member_id is not null), '[]'::json) as shares
       from module_owe_no.owe_no_movements mv
       left join module_owe_no.owe_no_movement_shares s on s.movement_id = mv.id
      where mv.group_id = $1 and mv.deleted_at is null
      group by mv.id
      order by mv.occurred_on desc, mv.created_at desc`,
    [groupId],
  );
  return rows.map((row) => ({
    id: String(row.id),
    kind: row.kind as MovementView["kind"],
    description: String(row.description),
    amount_minor: Number(row.amount_minor),
    currency: String(row.currency),
    paid_by: String(row.paid_by_member_id),
    occurred_on: String(row.occurred_on),
    category_id: row.category_id === null ? null : String(row.category_id),
    shares: row.shares as MovementView["shares"],
  }));
}

/** Soft delete: the row and its shares stay, the history and balances change. */
export async function deleteMovement(
  deps: OweDeps,
  userId: string,
  groupId: string,
  movementId: string,
): Promise<void> {
  const member = await requireActiveMember(deps, userId, groupId);
  const { rows } = await deps.db.query(
    `select created_by from module_owe_no.owe_no_movements
      where id = $1 and group_id = $2 and deleted_at is null`,
    [movementId, groupId],
  );
  if (!rows[0]) throw new OweDomainError("not_found", "movement not found");
  const { rows: group } = await deps.db.query(
    "select created_by from module_owe_no.owe_no_groups where id = $1",
    [groupId],
  );
  const author = rows[0].created_by;
  if (author !== userId && group[0]?.created_by !== userId) {
    throw new OweDomainError("forbidden", "only the author or the group creator");
  }
  await deps.db.query(
    `update module_owe_no.owe_no_movements
        set deleted_at = now(), deleted_by = $3
      where id = $1 and group_id = $2`,
    [movementId, groupId, member.user_id],
  );
}

export async function balances(
  deps: OweDeps,
  userId: string,
  groupId: string,
): Promise<Map<string, number>> {
  await requireActiveMember(deps, userId, groupId);
  const movements = await listMovements(deps, userId, groupId);
  return computeBalances(
    movements.map((movement) => ({
      paidBy: movement.paid_by,
      amount_minor: movement.amount_minor,
      shares: movement.shares,
    })),
  );
}

export async function settlementPlan(
  deps: OweDeps,
  userId: string,
  groupId: string,
): Promise<SettlementPlan> {
  const current = await balances(deps, userId, groupId);
  const limit = await settlementLimit(deps);
  return settle(nonZeroBalances(current), limit);
}

async function settlementLimit(deps: OweDeps): Promise<number> {
  const { rows } = await deps.db.query(
    `select value from public.settings
      where category_key = 'owe_no' and key = 'owe_no.settlement_exact_limit'`,
  );
  const value = Number(rows[0]?.value ?? 12);
  return Number.isFinite(value) && value >= 4 && value <= 20 ? value : 12;
}
