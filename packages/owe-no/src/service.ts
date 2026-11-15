import { enqueueEvent } from "@027apps/core/realtime/service.js";
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

import { OweDomainError, type OweError } from "./errors";

export { OweDomainError };
export type { OweError };

/** One outbox row per event; the Core delivers it (push included). */
export async function emit(
  db: OweDb,
  type: string,
  resource: Record<string, unknown>,
  push: boolean,
): Promise<void> {
  // A group event belongs to its members: the channel drives both the realtime
  // broadcast and the push recipients (D12), not only the administrators.
  const groupId = typeof resource.group_id === "string" ? resource.group_id : null;
  await enqueueEvent(db as never, {
    type,
    target: groupId ? `channel:owe-no-group-${groupId}` : "admins",
    module_key: "owe-no",
    resource: resource as never,
    ...(push ? { notify: ["push"] } : {}),
  });
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
  /** The creator blocked this account: it cannot be added again. */
  blocked: boolean;
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
  input: { name: string; currency: string; locale?: string },
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
    const language = DEFAULT_CATEGORIES[input.locale ?? ""] ? (input.locale as string) : "en";
    for (const category of DEFAULT_CATEGORIES[language]) {
      await db.query(
        `insert into module_owe_no.owe_no_categories (group_id, name) values ($1, $2)
         on conflict do nothing`,
        [String(group[0].id), category],
      );
    }
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

export interface AdminGroupView extends GroupView {
  movements: number;
}

/** Panel view: every group, for administrators, without being a member. */
export async function listAllGroups(
  deps: OweDeps,
  query?: string,
): Promise<AdminGroupView[]> {
  const { rows } = await deps.db.query(
    `select g.id, g.name, g.currency, g.archived_at, g.created_by,
            (select count(*)::int from module_owe_no.owe_no_members m
              where m.group_id = g.id and m.state = 'active') as members,
            (select count(*)::int from module_owe_no.owe_no_movements mv
              where mv.group_id = g.id and mv.deleted_at is null) as movements
       from module_owe_no.owe_no_groups g
      where ($1::text is null or g.name ilike '%' || $1 || '%')
      order by g.created_at desc`,
    [query && query.trim() !== "" ? query.trim() : null],
  );
  return rows.map((row) => ({
    id: String(row.id),
    name: String(row.name),
    currency: String(row.currency),
    archived: row.archived_at !== null,
    created_by: row.created_by === null ? null : String(row.created_by),
    members: Number(row.members),
    role: "active" as const,
    movements: Number(row.movements),
  }));
}

export async function listMembers(
  deps: OweDeps,
  userId: string,
  groupId: string,
): Promise<MemberView[]> {
  const member = await memberFor(deps, userId, groupId);
  if (!member || member.state !== "active") {
    throw new OweDomainError("not_found", "group not found");
  }
  const { rows } = await deps.db.query(
    `select m.id, m.display_name, m.state, m.user_id,
            exists (
              select 1 from module_owe_no.owe_no_blocks b
               where b.group_id = m.group_id and b.user_id = m.user_id
            ) as blocked
       from module_owe_no.owe_no_members m
      where m.group_id = $1
        and (
          m.state <> 'removed'
          or exists (
            select 1 from module_owe_no.owe_no_blocks b
             where b.group_id = m.group_id and b.user_id = m.user_id
          )
        )
      order by m.display_name asc`,
    [key(groupId)],
  );
  return rows.map((row) => ({
    id: String(row.id),
    display_name: String(row.display_name),
    state: row.state as MemberView["state"],
    user_id: row.user_id === null ? null : String(row.user_id),
    kind: row.user_id === null ? "fictitious" : "user",
    blocked: Boolean(row.blocked),
  }));
}

/** Invites a registered user or adds a fictitious member (creator only). */
export async function addMember(
  deps: OweDeps,
  userId: string,
  groupId: string,
  input: { displayName: string; inviteeId?: string; active?: boolean },
): Promise<MemberView> {
  await assertGroupOpen(deps, groupId);
  await requireCreator(deps, userId, groupId);
  const displayName = input.displayName.trim();
  if (displayName.length === 0) throw new OweDomainError("validation_failed", "name is required");
  if (input.inviteeId) {
    const { rows: profile } = await deps.db.query(
      "select display_name from public.profiles where id = $1 and deactivated_at is null",
      [input.inviteeId],
    );
    if (!profile[0]) throw new OweDomainError("validation_failed", "unknown user");
    const { rows: block } = await deps.db.query(
      "select 1 from module_owe_no.owe_no_blocks where group_id = $1 and user_id = $2",
      [groupId, input.inviteeId],
    );
    if (block[0]) {
      throw new OweDomainError("conflict", "that account is blocked in this group", {
        code: "member_blocked",
      });
    }
  }
  // D30: a name without an account is a participant from the moment it is
  // added; only a real account waits for the invitation to be accepted.
  const state = input.inviteeId && input.active !== true ? "invited" : "active";
  const { rows } = await deps.db.query(
    `insert into module_owe_no.owe_no_members
       (group_id, user_id, display_name, state, invited_by, invited_at, joined_at)
     values ($1, $2, $3, $5, $4, now(), case when $5 = 'active' then now() end)
     on conflict (group_id, user_id) do update
       set state = case
             when module_owe_no.owe_no_members.state = 'active' then 'active'
             else $5
           end,
           invited_at = now(), invited_by = $4,
           joined_at = case when $5 = 'active' then now() else module_owe_no.owe_no_members.joined_at end
     returning id, display_name, state, user_id`,
    [groupId, input.inviteeId ?? null, displayName, userId, state],
  );
  const row = rows[0];
  return {
    id: String(row.id),
    display_name: String(row.display_name),
    state: row.state as MemberView["state"],
    user_id: row.user_id === null ? null : String(row.user_id),
    kind: row.user_id === null ? "fictitious" : "user",
    blocked: false,
  };
}

/**
 * Links a fictitious member to a real account (admins, from the panel). The
 * history stays: the member id does not change, only its owner, and the name is
 * the one the history already showed.
 */
export async function linkMember(
  deps: OweDeps,
  groupId: string,
  memberId: string,
  userId: string,
): Promise<void> {
  await assertGroupOpen(deps, groupId);
  const { rows: profile } = await deps.db.query(
    "select display_name from public.profiles where id = $1 and deactivated_at is null",
    [userId],
  );
  if (!profile[0]) throw new OweDomainError("validation_failed", "unknown user");
  const { rows: member } = await deps.db.query(
    `select id, user_id, state from module_owe_no.owe_no_members
      where id = $1 and group_id = $2`,
    [memberId, groupId],
  );
  if (!member[0]) throw new OweDomainError("not_found", "member not found");
  if (member[0].user_id !== null) {
    throw new OweDomainError("conflict", "the member already belongs to an account");
  }
  const { rows: blocked } = await deps.db.query(
    "select 1 from module_owe_no.owe_no_blocks where group_id = $1 and user_id = $2",
    [groupId, userId],
  );
  if (blocked[0]) {
    throw new OweDomainError("conflict", "that account is blocked in this group", {
      code: "member_blocked",
    });
  }
  const { rows: existing } = await deps.db.query(
    `select 1 from module_owe_no.owe_no_members
      where group_id = $1 and user_id = $2 and id <> $3`,
    [groupId, userId, memberId],
  );
  if (existing[0]) throw new OweDomainError("conflict", "that user is already a member");
  await deps.db.query(
    `update module_owe_no.owe_no_members
        set user_id = $3,
            state = case when state = 'invited' then 'active' else state end,
            joined_at = coalesce(joined_at, now())
      where id = $1 and group_id = $2`,
    [memberId, groupId, userId],
  );
  await emit(deps.db, "owe_no.member_linked", { group_id: groupId, member_id: memberId }, false);
}

/**
 * The creator links a name without an account to a real account (D31). The
 * member id does not change, so the history and the balance stay where they are.
 */
export async function linkMemberAsCreator(
  deps: OweDeps,
  actorId: string,
  groupId: string,
  memberId: string,
  userId: string,
): Promise<void> {
  await requireCreator(deps, actorId, groupId);
  await linkMember(deps, groupId, memberId, userId);
}

/** The invitee declines: the row stays as `left`, so a later invite can revive it. */
export async function declineInvitation(
  deps: OweDeps,
  userId: string,
  groupId: string,
): Promise<void> {
  const member = await memberFor(deps, userId, groupId);
  if (!member) throw new OweDomainError("not_found", "invitation not found");
  if (member.state !== "invited") {
    throw new OweDomainError("conflict", "there is no pending invitation", {
      code: "not_invited",
    });
  }
  await deps.db.query(
    `update module_owe_no.owe_no_members
        set state = 'left', left_at = now(), updated_at = now()
      where id = $1`,
    [member.id],
  );
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
  /** Author, so the client knows who may edit or delete it. */
  created_by: string | null;
  shares: Array<{ memberId: string; amount_minor: number }>;
}

export async function addMovement(
  deps: OweDeps,
  userId: string,
  groupId: string,
  input: MovementInput,
): Promise<MovementView> {
  await requireActiveMember(deps, userId, groupId);
  return createMovementForGroup(deps, userId, groupId, input);
}

/**
 * A group that exists and is open. Archived groups are read-only in the domain,
 * not just in the panel: the app could otherwise keep writing to one.
 */
export async function assertGroupOpen(deps: OweDeps, groupId: string): Promise<string> {
  const { rows } = await deps.db.query(
    "select currency, archived_at from module_owe_no.owe_no_groups where id = $1",
    [groupId],
  );
  if (!rows[0]) throw new OweDomainError("not_found", "group not found");
  if (rows[0].archived_at !== null) {
    throw new OweDomainError("conflict", "the group is archived", { code: "group_archived" });
  }
  return String(rows[0].currency);
}

/** Shares and currency of a movement, without inserting it (create and edit). */
export async function prepareMovement(
  deps: OweDeps,
  groupId: string,
  input: MovementInput,
): Promise<{ currency: string; shares: MovementView["shares"] }> {
  const currency = await assertGroupOpen(deps, groupId);
  const { rows: members } = await deps.db.query(
    "select id, state from module_owe_no.owe_no_members where group_id = $1",
    [groupId],
  );
  const states = Object.fromEntries(
    members.map((member) => [String(member.id), String(member.state)]),
  ) as Record<string, "invited" | "active" | "left" | "removed">;

  // Ids arrive from the client: a member of another group must never enter this
  // group's balances, and its name must not leak through a movement.
  const known = (id: string) => Object.prototype.hasOwnProperty.call(states, id);
  if (!known(input.paid_by)) {
    throw new OweDomainError("validation_failed", "payer is not a member of this group", {
      code: "unknown_member",
    });
  }
  for (const participant of input.participants) {
    if (!known(participant.memberId)) {
      throw new OweDomainError("validation_failed", "participant is not a member of this group", {
        code: "unknown_member",
      });
    }
  }

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

  return { currency, shares };
}

/** Inserts an already validated movement; the caller decided who may write. */
export async function createMovementForGroup(
  deps: OweDeps,
  actorId: string,
  groupId: string,
  input: MovementInput,
): Promise<MovementView> {
  const { currency, shares } = await prepareMovement(deps, groupId, input);
  if (input.category_id) {
    const { rows: category } = await deps.db.query(
      "select 1 from module_owe_no.owe_no_categories where id = $1 and group_id = $2",
      [input.category_id, groupId],
    );
    if (!category[0]) {
      throw new OweDomainError("validation_failed", "that category is not in this group", {
        code: "unknown_category",
      });
    }
  }
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
        actorId,
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
    // Context for the notification: what/where/who, never rendered as JSON.
    const { rows: context } = await db.query(
      `select g.name as group_name, p.display_name as actor_name
         from module_owe_no.owe_no_groups g
         left join public.profiles p on p.id = $2
        where g.id = $1`,
      [groupId, actorId],
    );
    await emit(db, "owe_no.movement_created", {
      group_id: groupId,
      movement_id: id,
      kind: input.kind,
      amount_minor: input.amount_minor,
      currency,
      description: input.description.trim(),
      group_name: context[0]?.group_name ?? null,
      actor_name: context[0]?.actor_name ?? null,
      actor_id: actorId,
    }, true);
    return {
      id,
      kind: input.kind,
      description: input.description.trim(),
      amount_minor: input.amount_minor,
      currency,
      paid_by: input.paid_by,
      occurred_on: input.occurred_on,
      category_id: input.category_id ?? null,
      created_by: actorId,
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
            mv.paid_by_member_id, to_char(mv.occurred_on, 'YYYY-MM-DD') as occurred_on,
            mv.category_id, mv.created_by,
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
    created_by: row.created_by === null ? null : String(row.created_by),
    shares: row.shares as MovementView["shares"],
  }));
}

/**
 * Edits a movement the caller authored (or the creator): the same invariants as
 * a new one, and the shares are replaced in one transaction so balances never
 * see a half-edited row.
 */
export async function updateMovement(
  deps: OweDeps,
  userId: string,
  groupId: string,
  movementId: string,
  input: MovementInput & { description: string; category_id?: string | null },
): Promise<void> {
  await assertGroupOpen(deps, groupId);
  await requireActiveMember(deps, userId, groupId);
  const { rows: existing } = await deps.db.query(
    `select kind, created_by from module_owe_no.owe_no_movements
      where id = $1 and group_id = $2 and deleted_at is null`,
    [movementId, groupId],
  );
  if (!existing[0]) throw new OweDomainError("not_found", "movement not found");
  const { rows: group } = await deps.db.query(
    "select created_by from module_owe_no.owe_no_groups where id = $1",
    [groupId],
  );
  if (existing[0].created_by !== userId && group[0]?.created_by !== userId) {
    throw new OweDomainError("forbidden", "only the author or the group creator");
  }
  const { currency, shares } = await prepareMovement(deps, groupId, {
    ...input,
    kind: existing[0].kind as "expense" | "settlement",
  });
  if (input.category_id) {
    const { rows: category } = await deps.db.query(
      "select 1 from module_owe_no.owe_no_categories where id = $1 and group_id = $2",
      [input.category_id, groupId],
    );
    if (!category[0]) {
      throw new OweDomainError("validation_failed", "that category is not in this group", {
        code: "unknown_category",
      });
    }
  }
  const run = deps.withTransaction ?? (<T,>(fn: (db: OweDb) => Promise<T>) => fn(deps.db));
  await run(async (db) => {
    await db.query(
      `update module_owe_no.owe_no_movements
          set description = $3, amount_minor = $4, currency = $5,
              paid_by_member_id = $6, category_id = $7, occurred_on = $8
        where id = $1 and group_id = $2`,
      [
        movementId,
        groupId,
        input.description.trim(),
        input.amount_minor,
        currency,
        input.paid_by,
        input.category_id ?? null,
        input.occurred_on,
      ],
    );
    await db.query("delete from module_owe_no.owe_no_movement_shares where movement_id = $1", [
      movementId,
    ]);
    for (const share of shares) {
      await db.query(
        `insert into module_owe_no.owe_no_movement_shares (movement_id, member_id, amount_minor)
         values ($1, $2, $3)`,
        [movementId, share.memberId, share.amount_minor],
      );
    }
    await emit(db, "owe_no.movement_updated", { group_id: groupId, movement_id: movementId }, true);
  });
}

/** Soft delete: the row and its shares stay, the history and balances change. */
export async function deleteMovement(
  deps: OweDeps,
  userId: string,
  groupId: string,
  movementId: string,
): Promise<void> {
  await assertGroupOpen(deps, groupId);
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
  await emit(deps.db, "owe_no.movement_deleted", { group_id: groupId, movement_id: movementId }, true);
}

/** Balances of every member of a group, from the single SQL definition. */
export async function groupBalances(deps: OweDeps, groupId: string): Promise<Map<string, number>> {
  const { rows } = await deps.db.query(
    `select member_id, amount_minor
       from module_owe_no.owe_no_balances
      where group_id = $1`,
    [groupId],
  );
  return new Map(rows.map((row) => [String(row.member_id), Number(row.amount_minor)]));
}

export async function balances(
  deps: OweDeps,
  userId: string,
  groupId: string,
): Promise<Map<string, number>> {
  await requireActiveMember(deps, userId, groupId);
  return groupBalances(deps, groupId);
}

/** The plan for a group, with no membership check: the panel is the caller. */
export async function settlementPlanForGroup(
  deps: OweDeps,
  groupId: string,
): Promise<SettlementPlan> {
  const current = await groupBalances(deps, groupId);
  const limit = await settlementLimit(deps);
  return settle(nonZeroBalances(current), limit);
}

export async function settlementPlan(
  deps: OweDeps,
  userId: string,
  groupId: string,
): Promise<SettlementPlan> {
  await requireActiveMember(deps, userId, groupId);
  return settlementPlanForGroup(deps, groupId);
}

async function settlementLimit(deps: OweDeps): Promise<number> {
  const { rows } = await deps.db.query(
    `select value from public.settings
      where category_key = 'owe_no' and key = 'owe_no.settlement_exact_limit'`,
  );
  const value = Number(rows[0]?.value ?? 12);
  return Number.isFinite(value) && value >= 4 && value <= 20 ? value : 12;
}

/** Active members of a group, without the ones already removed. */
async function activeMemberCount(deps: OweDeps, groupId: string): Promise<number> {
  const { rows } = await deps.db.query(
    `select count(*)::int as total from module_owe_no.owe_no_members
      where group_id = $1 and state = 'active'`,
    [groupId],
  );
  return Number(rows[0]?.total ?? 0);
}

async function requireZeroBalance(deps: OweDeps, groupId: string, memberId: string): Promise<void> {
  const balances = await groupBalances(deps, groupId);
  if ((balances.get(memberId) ?? 0) !== 0) {
    throw new OweDomainError("conflict", "settle the member's balance first", {
      code: "member_has_balance",
    });
  }
}

/**
 * A member leaves a group. Only with a zero balance: without an active member a
 * payment could never close the debt. The creator hands the group to the oldest
 * active account (a group without a reachable creator cannot be managed).
 */
export async function leaveGroup(
  deps: OweDeps,
  userId: string,
  groupId: string,
): Promise<void> {
  const group = await assertGroupOpen(deps, groupId);
  void group;
  const member = await requireActiveMember(deps, userId, groupId);
  await requireZeroBalance(deps, groupId, member.id);
  if ((await activeMemberCount(deps, groupId)) <= 1) {
    throw new OweDomainError("conflict", "a group needs an active member", {
      code: "last_member",
    });
  }

  const { rows: rowsGroup } = await deps.db.query(
    "select created_by from module_owe_no.owe_no_groups where id = $1",
    [groupId],
  );
  const isCreator = rowsGroup[0]?.created_by === userId;
  const run = deps.withTransaction ?? (<T,>(fn: (db: OweDb) => Promise<T>) => fn(deps.db));
  await run(async (db) => {
    if (isCreator) {
      const { rows: next } = await db.query(
        `select user_id from module_owe_no.owe_no_members
          where group_id = $1 and state = 'active' and user_id is not null and id <> $2
          order by created_at asc limit 1`,
        [groupId, member.id],
      );
      if (!next[0]) {
        throw new OweDomainError("conflict", "add another account before leaving", {
          code: "no_other_account",
        });
      }
      await db.query(
        "update module_owe_no.owe_no_groups set created_by = $2, updated_at = now() where id = $1",
        [groupId, next[0].user_id],
      );
    }
    await db.query(
      `update module_owe_no.owe_no_members
          set state = 'left', left_at = now(), updated_at = now()
        where id = $1`,
      [member.id],
    );
  });
}

/** The creator removes a member; the balance must be zero (D19). */
export async function removeMember(
  deps: OweDeps,
  actorId: string,
  groupId: string,
  memberId: string,
  mode: "settle" | "ghost" = "settle",
): Promise<void> {
  await assertGroupOpen(deps, groupId);
  await requireCreator(deps, actorId, groupId);
  const { rows: member } = await deps.db.query(
    "select id, user_id, state from module_owe_no.owe_no_members where id = $1 and group_id = $2",
    [memberId, groupId],
  );
  if (!member[0]) throw new OweDomainError("not_found", "member not found");
  if (member[0].state === "removed" || member[0].state === "left") {
    throw new OweDomainError("not_found", "member is no longer in the group");
  }
  if (member[0].user_id === actorId) {
    throw new OweDomainError("conflict", "use leave to exit your own group", {
      code: "cannot_remove_self",
    });
  }
  if (member[0].state === "active") {
    if ((await activeMemberCount(deps, groupId)) <= 1) {
      throw new OweDomainError("conflict", "a group needs an active member", {
        code: "last_member",
      });
    }
    const balances = await groupBalances(deps, groupId);
    const balance = balances.get(memberId) ?? 0;
    if (balance !== 0) {
      if (mode === "ghost" && member[0].user_id === null) {
        // A fictitious row already has no account to detach: "keep the balance"
        // would be a silent no-op, so it is refused like any other removal
        // with a pending balance.
        throw new OweDomainError("conflict", "settle the member's balance first", {
          code: "member_has_balance",
        });
      }
      if (mode === "ghost") {
        // D29: the account leaves but the balance stays with a fictitious row.
        await deps.db.query(
          `update module_owe_no.owe_no_members
              set user_id = null, updated_at = now()
            where id = $1 and group_id = $2`,
          [memberId, groupId],
        );
        return;
      }
      throw new OweDomainError("conflict", "settle the member's balance first", {
        code: "member_has_balance",
      });
    }
  }
  await deps.db.query(
    `update module_owe_no.owe_no_members
        set state = 'removed', left_at = now(), updated_at = now()
      where id = $1 and group_id = $2`,
    [memberId, groupId],
  );
}

/** Blocks an account so it cannot be invited again; it must have no balance. */
export async function blockMember(
  deps: OweDeps,
  actorId: string,
  groupId: string,
  memberId: string,
  mode: "settle" | "ghost" = "settle",
): Promise<void> {
  await assertGroupOpen(deps, groupId);
  await requireCreator(deps, actorId, groupId);
  const { rows: member } = await deps.db.query(
    "select id, user_id, state from module_owe_no.owe_no_members where id = $1 and group_id = $2",
    [memberId, groupId],
  );
  if (!member[0]) throw new OweDomainError("not_found", "member not found");
  if (member[0].user_id === null) {
    throw new OweDomainError("validation_failed", "a fictitious member has no account to block", {
      code: "fictitious_member",
    });
  }
  if (member[0].user_id === actorId) {
    throw new OweDomainError("conflict", "you cannot block yourself", { code: "cannot_block_self" });
  }
  if (member[0].state === "active") {
    if ((await activeMemberCount(deps, groupId)) <= 1) {
      throw new OweDomainError("conflict", "a group needs an active member", {
        code: "last_member",
      });
    }
    const balances = await groupBalances(deps, groupId);
    if ((balances.get(memberId) ?? 0) !== 0 && mode !== "ghost") {
      throw new OweDomainError("conflict", "settle the member's balance first", {
        code: "member_has_balance",
      });
    }
  }
  const balance = (await groupBalances(deps, groupId)).get(memberId) ?? 0;
  const ghost = balance !== 0 && mode === "ghost";
  const run = deps.withTransaction ?? (<T,>(fn: (db: OweDb) => Promise<T>) => fn(deps.db));
  await run(async (db) => {
    if (ghost) {
      await db.query(
        `update module_owe_no.owe_no_members
            set user_id = null, updated_at = now()
          where id = $1 and group_id = $2`,
        [memberId, groupId],
      );
      // The account is gone from the group, so there is nothing left to block:
      // a block row keyed by a user that no longer owns a member could never be
      // lifted again.
      return;
    }
    await db.query(
      `update module_owe_no.owe_no_members
          set state = 'removed', left_at = now(), updated_at = now()
        where id = $1 and group_id = $2`,
      [memberId, groupId],
    );
    await db.query(
      `insert into module_owe_no.owe_no_blocks (group_id, user_id, blocked_by)
       values ($1, $2, $3)
       on conflict (group_id, user_id) do update set blocked_by = excluded.blocked_by`,
      [groupId, member[0].user_id, actorId],
    );
  });
}

/** Lifts a block; the account can be invited again (not a member by itself). */
export async function unblockMember(
  deps: OweDeps,
  actorId: string,
  groupId: string,
  memberId: string,
): Promise<void> {
  await assertGroupOpen(deps, groupId);
  await requireCreator(deps, actorId, groupId);
  const { rows: member } = await deps.db.query(
    "select user_id from module_owe_no.owe_no_members where id = $1 and group_id = $2",
    [memberId, groupId],
  );
  if (!member[0]) throw new OweDomainError("not_found", "member not found");
  if (member[0].user_id === null) {
    throw new OweDomainError("validation_failed", "a fictitious member has no block", {
      code: "fictitious_member",
    });
  }
  await deps.db.query(
    "delete from module_owe_no.owe_no_blocks where group_id = $1 and user_id = $2",
    [groupId, member[0].user_id],
  );
}

export interface CategoryView {
  id: string;
  name: string;
  archived: boolean;
}

/** Group-scoped default categories, in the language the group was created with. */
const DEFAULT_CATEGORIES: Record<string, string[]> = {
  es: ["Casa", "Comida", "Transporte", "Ocio", "Salud", "Otros"],
  en: ["Home", "Food", "Transport", "Leisure", "Health", "Other"],
  ca: ["Casa", "Menjar", "Transport", "Oci", "Salut", "Altres"],
  it: ["Casa", "Cibo", "Trasporti", "Tempo libero", "Salute", "Altro"],
  fr: ["Maison", "Nourriture", "Transport", "Loisirs", "Santé", "Autre"],
  de: ["Zuhause", "Essen", "Transport", "Freizeit", "Gesundheit", "Sonstiges"],
  pt: ["Casa", "Comida", "Transporte", "Lazer", "Saúde", "Outros"],
  gl: ["Casa", "Comida", "Transporte", "Ocio", "Saúde", "Outros"],
  eu: ["Etxea", "Janaria", "Garraioa", "Aisia", "Osasuna", "Besteak"],
};

function assertCategoryName(raw: string): string {
  const name = raw.trim();
  if (name.length === 0 || name.length > 40) {
    throw new OweDomainError("validation_failed", "a category needs a name of 1 to 40 characters");
  }
  return name;
}

async function assertCategoryNameFree(
  deps: OweDeps,
  groupId: string,
  name: string,
  exceptId?: string,
): Promise<void> {
  const { rows } = await deps.db.query(
    `select 1 from module_owe_no.owe_no_categories
      where group_id = $1 and archived_at is null and lower(name) = lower($2)
        and ($3::uuid is null or id <> $3)`,
    [groupId, name, exceptId ?? null],
  );
  if (rows[0]) {
    throw new OweDomainError("conflict", "that category already exists", {
      code: "category_exists",
    });
  }
}

/** Categories of a group, for the movement form (active members only). */
export async function listCategories(
  deps: OweDeps,
  userId: string,
  groupId: string,
): Promise<CategoryView[]> {
  await requireActiveMember(deps, userId, groupId);
  const { rows } = await deps.db.query(
    `select id, name, archived_at from module_owe_no.owe_no_categories
      where group_id = $1 order by archived_at nulls first, name`,
    [groupId],
  );
  return rows.map((row) => ({
    id: String(row.id),
    name: String(row.name),
    archived: row.archived_at !== null,
  }));
}

/** Any active member files, renames and archives the group's categories. */
export async function createCategory(
  deps: OweDeps,
  userId: string,
  groupId: string,
  rawName: string,
): Promise<CategoryView> {
  await requireActiveMember(deps, userId, groupId);
  const name = assertCategoryName(rawName);
  await assertCategoryNameFree(deps, groupId, name);
  const { rows } = await deps.db.query(
    `insert into module_owe_no.owe_no_categories (group_id, name) values ($1, $2)
     returning id, name`,
    [groupId, name],
  );
  return { id: String(rows[0].id), name: String(rows[0].name), archived: false };
}

export async function renameCategory(
  deps: OweDeps,
  userId: string,
  groupId: string,
  categoryId: string,
  rawName: string,
): Promise<CategoryView> {
  await requireActiveMember(deps, userId, groupId);
  const name = assertCategoryName(rawName);
  await assertCategoryNameFree(deps, groupId, name, categoryId);
  const { rows } = await deps.db.query(
    `update module_owe_no.owe_no_categories set name = $3
      where id = $1 and group_id = $2 and archived_at is null
      returning id, name`,
    [categoryId, groupId, name],
  );
  if (!rows[0]) throw new OweDomainError("not_found", "category not found");
  return { id: String(rows[0].id), name: String(rows[0].name), archived: false };
}

export async function archiveCategory(
  deps: OweDeps,
  userId: string,
  groupId: string,
  categoryId: string,
  archived: boolean,
): Promise<CategoryView> {
  await requireActiveMember(deps, userId, groupId);
  const { rows } = await deps.db.query(
    `update module_owe_no.owe_no_categories
        set archived_at = case when $3 then now() else null end
      where id = $1 and group_id = $2
      returning id, name, archived_at`,
    [categoryId, groupId, archived],
  );
  if (!rows[0]) throw new OweDomainError("not_found", "category not found");
  return {
    id: String(rows[0].id),
    name: String(rows[0].name),
    archived: rows[0].archived_at !== null,
  };
}
