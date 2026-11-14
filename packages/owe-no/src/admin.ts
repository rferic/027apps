import type { Caller } from "@027apps/core/api/types.js";
import {
  OweDomainError,
  assertGroupOpen,
  createMovementForGroup,
  emit,
  groupBalances,
  prepareMovement,
  settlementPlanForGroup,
  type MovementInput,
  type MovementView,
  type OweDeps,
} from "./service";
import type { SettlementPlan } from "./settlement";

/**
 * OweNo as an administrator sees it (D26).
 *
 * The panel acts as an instance administrator, not as a member: these
 * functions work on any group and keep the member rules of `service.ts`
 * untouched. Every one of them re-checks the role, because a domain function is
 * the last line before the database — the panel gate is the first, not the only.
 */
export interface AdminMemberView {
  id: string;
  display_name: string;
  state: "invited" | "active" | "left" | "removed";
  user_id: string | null;
  balance: number;
}

export interface AdminGroupView {
  id: string;
  name: string;
  currency: string;
  archived: boolean;
  created_by: string | null;
  members: number;
  movements: number;
}

export interface AdminCategoryView {
  id: string;
  name: string;
}

/** A movement plus the audit the panel can show (who created or edited it). */
export interface AdminMovementView extends MovementView {
  created_by_name: string | null;
  updated_by_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdminGroupDetail {
  group: AdminGroupView & { archived_by: string | null };
  members: AdminMemberView[];
  movements: AdminMovementView[];
  categories: AdminCategoryView[];
}

export interface AdminUserOption {
  id: string;
  display_name: string;
}

function runInTransaction<T>(deps: OweDeps, fn: (db: OweDeps["db"]) => Promise<T>): Promise<T> {
  return deps.withTransaction ? deps.withTransaction(fn) : fn(deps.db);
}

/** The signed-in administrator, or a refusal. Never trust the route alone. */
function requireAdmin(caller: Caller): string {
  if (caller.kind !== "session") throw new OweDomainError("forbidden", "an admin session is required");
  if (caller.role !== "admin" && caller.role !== "super_admin") {
    throw new OweDomainError("forbidden", "an admin session is required");
  }
  return caller.userId;
}

/** One group with its members, balances and live movements. */
export async function adminGroupDetail(
  deps: OweDeps,
  caller: Caller,
  groupId: string,
): Promise<AdminGroupDetail> {
  requireAdmin(caller);
  const { rows: group } = await deps.db.query(
    `select g.id, g.name, g.currency, g.archived_at, g.created_by, g.archived_by,
            (select count(*)::int from module_owe_no.owe_no_members m
              where m.group_id = g.id and m.state = 'active') as members,
            (select count(*)::int from module_owe_no.owe_no_movements mv
              where mv.group_id = g.id and mv.deleted_at is null) as movements
       from module_owe_no.owe_no_groups g
      where g.id = $1`,
    [groupId],
  );
  if (!group[0]) throw new OweDomainError("not_found", "group not found");

  const balances = await groupBalances(deps, groupId);
  const { rows: members } = await deps.db.query(
    `select id, display_name, state, user_id
       from module_owe_no.owe_no_members
      where group_id = $1
      order by (state = 'active') desc, display_name`,
    [groupId],
  );
  const movements = await adminMovements(deps, groupId);
  const { rows: categories } = await deps.db.query(
    `select id, name from module_owe_no.owe_no_categories
      where group_id = $1 order by name`,
    [groupId],
  );

  return {
    group: {
      id: String(group[0].id),
      name: String(group[0].name),
      currency: String(group[0].currency),
      archived: group[0].archived_at !== null,
      created_by: group[0].created_by === null ? null : String(group[0].created_by),
      archived_by: group[0].archived_by === null ? null : String(group[0].archived_by),
      members: Number(group[0].members),
      movements: Number(group[0].movements),
    },
    members: members.map((row) => ({
      id: String(row.id),
      display_name: String(row.display_name),
      state: row.state as AdminMemberView["state"],
      user_id: row.user_id === null ? null : String(row.user_id),
      balance: balances.get(String(row.id)) ?? 0,
    })),
    movements,
    categories: categories.map((row) => ({ id: String(row.id), name: String(row.name) })),
  };
}

/**
 * Every live movement of the group, newest first. The panel caps the list at
 * 100: `group.movements` still counts them all, so the page can say so.
 */
async function adminMovements(deps: OweDeps, groupId: string): Promise<AdminMovementView[]> {
  const { rows } = await deps.db.query(
    `select mv.id, mv.kind, mv.description, mv.amount_minor, mv.currency,
            mv.paid_by_member_id, to_char(mv.occurred_on, 'YYYY-MM-DD') as occurred_on,
            mv.category_id,
            mv.created_at, mv.updated_at,
            c.display_name as created_by_name, u.display_name as updated_by_name,
            coalesce(json_agg(json_build_object('memberId', s.member_id,
                                                'amount_minor', s.amount_minor))
                       filter (where s.member_id is not null), '[]'::json) as shares
       from module_owe_no.owe_no_movements mv
       left join module_owe_no.owe_no_movement_shares s on s.movement_id = mv.id
       left join public.profiles c on c.id = mv.created_by
       left join public.profiles u on u.id = mv.updated_by
      where mv.group_id = $1 and mv.deleted_at is null
      group by mv.id, c.display_name, u.display_name
      order by mv.occurred_on desc, mv.created_at desc
      limit 100`,
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
    created_by_name: row.created_by_name === null ? null : String(row.created_by_name),
    updated_by_name: row.updated_by_name === null ? null : String(row.updated_by_name),
    created_at: new Date(String(row.created_at)).toISOString(),
    updated_at: new Date(String(row.updated_at)).toISOString(),
  }));
}

/** Accounts an administrator can add to a group, by name. */
export async function adminUserOptions(deps: OweDeps, caller: Caller): Promise<AdminUserOption[]> {
  requireAdmin(caller);
  const { rows } = await deps.db.query(
    `select id, display_name
       from public.profiles
      where deactivated_at is null
      order by display_name
      limit 200`,
  );
  return rows.map((row) => ({ id: String(row.id), display_name: String(row.display_name) }));
}

/**
 * Creates a group with the administrator as its creator and first active
 * member: a group without a payer has no possible expense.
 */
export async function adminCreateGroup(
  deps: OweDeps,
  caller: Caller,
  input: { name: string; currency: string },
): Promise<AdminGroupView> {
  const adminId = requireAdmin(caller);
  const name = input.name.trim();
  if (name.length === 0 || name.length > 80) {
    throw new OweDomainError("validation_failed", "name is required");
  }
  if (!/^[A-Z]{3}$/.test(input.currency)) {
    throw new OweDomainError("validation_failed", "currency must be ISO 4217");
  }

  const { rows: profile } = await deps.db.query(
    "select display_name from public.profiles where id = $1",
    [adminId],
  );
  if (!profile[0]) throw new OweDomainError("forbidden", "unknown administrator");
  const displayName = String(profile[0].display_name);

  return runInTransaction(deps, async (db) => {
    const { rows } = await db.query(
      `insert into module_owe_no.owe_no_groups (name, currency, created_by)
       values ($1, $2, $3) returning id, name, currency, archived_at, created_by`,
      [name, input.currency, adminId],
    );
    const groupId = String(rows[0].id);
    await db.query(
      `insert into module_owe_no.owe_no_members
         (group_id, user_id, display_name, state, added_by, joined_at)
       values ($1, $2, $3, 'active', $2, now())`,
      [groupId, adminId, displayName],
    );
    return {
      id: groupId,
      name,
      currency: input.currency,
      archived: false,
      created_by: adminId,
      members: 1,
      movements: 0,
    };
  });
}

/** Archives or reopens a group. Archiving records who did it. */
export async function adminSetArchived(
  deps: OweDeps,
  caller: Caller,
  groupId: string,
  archived: boolean,
): Promise<void> {
  const adminId = requireAdmin(caller);
  const { rows } = await deps.db.query(
    `update module_owe_no.owe_no_groups
        set archived_at = case when $2 then now() else null end,
            archived_by = case when $2 then $3::uuid else null end,
            updated_at = now()
      where id = $1
      returning id`,
    [groupId, archived, adminId],
  );
  if (!rows[0]) throw new OweDomainError("not_found", "group not found");
}

/** Adds an active member; an account is optional (a fictitious member). */
export async function adminAddMember(
  deps: OweDeps,
  caller: Caller,
  groupId: string,
  input: { displayName: string; userId?: string | null },
): Promise<AdminMemberView> {
  const adminId = requireAdmin(caller);
  await assertGroupOpen(deps, groupId);
  const displayName = input.displayName.trim();
  if (displayName.length === 0 || displayName.length > 80) {
    throw new OweDomainError("validation_failed", "name is required");
  }
  if (input.userId) {
    const { rows: existing } = await deps.db.query(
      `select id, state from module_owe_no.owe_no_members
        where group_id = $1 and user_id = $2`,
      [groupId, input.userId],
    );
    if (existing[0] && existing[0].state !== "removed") {
      throw new OweDomainError("conflict", "that account is already in the group", {
        code: "member_exists",
      });
    }
    const { rows: profile } = await deps.db.query(
      "select display_name from public.profiles where id = $1 and deactivated_at is null",
      [input.userId],
    );
    if (!profile[0]) throw new OweDomainError("validation_failed", "unknown user");
    if (existing[0]) {
      // A removed account comes back with its history: the row stays the same.
      const { rows: revived } = await deps.db.query(
        `update module_owe_no.owe_no_members
            set display_name = $3, state = 'active', added_by = $4,
                joined_at = now(), left_at = null, updated_at = now()
          where id = $1 and group_id = $2
          returning id, display_name, state, user_id`,
        [String(existing[0].id), groupId, displayName, adminId],
      );
      return {
        id: String(revived[0].id),
        display_name: String(revived[0].display_name),
        state: "active",
        user_id: input.userId,
        balance: 0,
      };
    }
  }

  const { rows } = await deps.db.query(
    `insert into module_owe_no.owe_no_members
       (group_id, user_id, display_name, state, added_by, joined_at)
     values ($1, $2, $3, 'active', $4, now())
     returning id, display_name, state, user_id`,
    [groupId, input.userId ?? null, displayName, adminId],
  );
  return {
    id: String(rows[0].id),
    display_name: String(rows[0].display_name),
    state: "active",
    user_id: rows[0].user_id === null ? null : String(rows[0].user_id),
    balance: 0,
  };
}

/** Attaches a real account to a fictitious member (its history stays). */
export async function adminLinkMember(
  deps: OweDeps,
  caller: Caller,
  groupId: string,
  memberId: string,
  userId: string,
): Promise<void> {
  requireAdmin(caller);
  await assertGroupOpen(deps, groupId);
  const { rows: member } = await deps.db.query(
    `select id, user_id from module_owe_no.owe_no_members
      where id = $1 and group_id = $2`,
    [memberId, groupId],
  );
  if (!member[0]) throw new OweDomainError("not_found", "member not found");
  if (member[0].user_id !== null && String(member[0].user_id) !== userId) {
    throw new OweDomainError("conflict", "the member already has an account", {
      code: "member_linked",
    });
  }
  const { rows: taken } = await deps.db.query(
    `select 1 from module_owe_no.owe_no_members
      where group_id = $1 and user_id = $2 and id <> $3`,
    [groupId, userId, memberId],
  );
  if (taken[0]) {
    throw new OweDomainError("conflict", "that account is already in the group", {
      code: "member_exists",
    });
  }
  const { rows: profile } = await deps.db.query(
    "select 1 from public.profiles where id = $1 and deactivated_at is null",
    [userId],
  );
  if (!profile[0]) throw new OweDomainError("validation_failed", "unknown user");

  await deps.db.query(
    `update module_owe_no.owe_no_members
        set user_id = $3, updated_at = now()
      where id = $1 and group_id = $2`,
    [memberId, groupId, userId],
  );
  await emit(
    deps.db,
    "owe_no.member_linked",
    { group_id: groupId, member_id: memberId, user_id: userId },
    false,
  );
}

/**
 * Removes a member. Only a zero balance can be removed: settlements need an
 * active payer and receiver, so a removed member's debt could never be paid.
 */
export async function adminRemoveMember(
  deps: OweDeps,
  caller: Caller,
  groupId: string,
  memberId: string,
): Promise<void> {
  requireAdmin(caller);
  await assertGroupOpen(deps, groupId);
  const { rows: member } = await deps.db.query(
    `select id from module_owe_no.owe_no_members
      where id = $1 and group_id = $2`,
    [memberId, groupId],
  );
  if (!member[0]) throw new OweDomainError("not_found", "member not found");
  const { rows: active } = await deps.db.query(
    `select count(*)::int as total from module_owe_no.owe_no_members
      where group_id = $1 and state = 'active'`,
    [groupId],
  );
  if (Number(active[0]?.total ?? 0) <= 1) {
    throw new OweDomainError("conflict", "a group needs an active member", {
      code: "last_member",
    });
  }
  const balances = await groupBalances(deps, groupId);
  if ((balances.get(memberId) ?? 0) !== 0) {
    throw new OweDomainError("conflict", "settle the member's balance first", {
      code: "member_has_balance",
    });
  }
  await deps.db.query(
    `update module_owe_no.owe_no_members
        set state = 'removed', left_at = now(), updated_at = now()
      where id = $1 and group_id = $2`,
    [memberId, groupId],
  );
}

export async function adminCreateMovement(
  deps: OweDeps,
  caller: Caller,
  groupId: string,
  input: MovementInput,
): Promise<MovementView> {
  const adminId = requireAdmin(caller);
  return createMovementForGroup(deps, adminId, groupId, input);
}

/**
 * Edits a movement and recomputes its shares. The kind is immutable: turning an
 * expense into a settlement is a delete plus a create, so the history reads
 * straight.
 */
export async function adminUpdateMovement(
  deps: OweDeps,
  caller: Caller,
  groupId: string,
  movementId: string,
  input: MovementInput,
): Promise<MovementView> {
  const adminId = requireAdmin(caller);
  await assertGroupOpen(deps, groupId);
  const { rows: existing } = await deps.db.query(
    `select kind from module_owe_no.owe_no_movements
      where id = $1 and group_id = $2 and deleted_at is null`,
    [movementId, groupId],
  );
  if (!existing[0]) throw new OweDomainError("not_found", "movement not found");
  if (String(existing[0].kind) !== input.kind) {
    throw new OweDomainError("validation_failed", "the movement kind cannot change", {
      code: "kind_immutable",
    });
  }
  const { currency, shares } = await prepareMovement(deps, groupId, input);

  return runInTransaction(deps, async (db) => {
    await db.query(
      `update module_owe_no.owe_no_movements
          set description = $3, amount_minor = $4, paid_by_member_id = $5,
              category_id = $6, occurred_on = $7, updated_by = $8, updated_at = now()
        where id = $1 and group_id = $2`,
      [
        movementId,
        groupId,
        input.description.trim(),
        input.amount_minor,
        input.paid_by,
        input.category_id ?? null,
        input.occurred_on,
        adminId,
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
    await emit(db, "owe_no.movement_updated", {
      group_id: groupId,
      movement_id: movementId,
      kind: input.kind,
      amount_minor: input.amount_minor,
    }, true);
    return {
      id: movementId,
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

/** Soft delete, whatever the author: the row stays for audit and history. */
export async function adminDeleteMovement(
  deps: OweDeps,
  caller: Caller,
  groupId: string,
  movementId: string,
): Promise<void> {
  const adminId = requireAdmin(caller);
  await assertGroupOpen(deps, groupId);
  const { rows } = await deps.db.query(
    `update module_owe_no.owe_no_movements
        set deleted_at = now(), deleted_by = $3, updated_at = now()
      where id = $1 and group_id = $2 and deleted_at is null
      returning id`,
    [movementId, groupId, adminId],
  );
  if (!rows[0]) throw new OweDomainError("not_found", "movement not found");
  await emit(deps.db, "owe_no.movement_deleted", { group_id: groupId, movement_id: movementId }, true);
}

/** The settlement plan of any group; the panel then records each payment. */
export async function adminSettlementPlan(
  deps: OweDeps,
  caller: Caller,
  groupId: string,
): Promise<SettlementPlan> {
  requireAdmin(caller);
  return settlementPlanForGroup(deps, groupId);
}
