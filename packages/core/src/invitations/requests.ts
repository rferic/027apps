import { DomainError } from "../errors";
import { enqueueEvent } from "../realtime/service";
import type { Caller } from "../api/types";
import type { QueryClient } from "../api/rate-limit-storage";
import { invitationQuota, type InvitationQuota } from "./quota";
import { withInviteTx } from "./shared";
import type { InvitationsDeps } from "./service";

/**
 * Quota requests and grants (sprint 18 spec §5.5/§6.2/§6.4/§7.4): a member
 * with no seats left asks an administrator for more; approving a request
 * creates exactly one revocable grant, so two admins clicking together can
 * never double the grant. The events ride the transactional outbox and carry
 * push to the administrators (`requested`) and to the requester (`resolved`).
 */

export type InvitationRequestState = "pending" | "approved" | "rejected" | "cancelled";
/** `all` is the explicit "no state filter" for the admin list. */
export type InvitationRequestFilter = InvitationRequestState | "all";

export type InvitationRequestView = {
  id: string;
  requester: { id: string; display_name: string; level: number | null };
  amount: number;
  reason: string | null;
  state: InvitationRequestState;
  granted_amount: number | null;
  resolution_reason: string | null;
  resolved_by: { id: string; display_name: string } | null;
  resolved_at: string | null;
  created_at: string;
};

/** One admin-list row: the request plus the requester's live quota. */
export type InvitationRequestListRow = InvitationRequestView & {
  quota: InvitationQuota;
};

export type GrantView = {
  id: string;
  user_id: string;
  amount: number;
  granted_by: { id: string; display_name: string } | null;
  request_id: string | null;
  reason: string | null;
  revoked_at: string | null;
  created_at: string;
};

export interface InvitationRequestPage {
  limit: number;
  offset: number;
  state?: InvitationRequestFilter;
}

const toIso = (value: unknown): string =>
  value instanceof Date ? value.toISOString() : String(value ?? "");
const toIsoOrNull = (value: unknown): string | null =>
  value === null || value === undefined ? null : toIso(value);

/** The profile behind `resolved_by`/`granted_by`; a service key has none. */
function actorFor(caller: Caller): { by: string | null; byKey: string | null } {
  if (caller.kind === "session") return { by: caller.userId, byKey: null };
  if (caller.kind === "service" || caller.kind === "delegated") {
    return { by: null, byKey: caller.keyId };
  }
  throw new DomainError("unauthorized");
}

/** The request amount is a seat count, never money (1..20). */
function requestAmount(value: number): number {
  if (!Number.isInteger(value) || value < 1 || value > 20) {
    throw new DomainError("validation_failed", "amount must be an integer between 1 and 20");
  }
  return value;
}

/** A grant amount is a seat count, never money (1..100). */
function grantAmount(value: number): number {
  if (!Number.isInteger(value) || value < 1 || value > 100) {
    throw new DomainError("validation_failed", "amount must be an integer between 1 and 100");
  }
  return value;
}

/** Trims an optional reason to the stored contract: null or 1..280 characters. */
function optionalReason(value: string | undefined): string | null {
  const trimmed = (value ?? "").trim();
  if (trimmed.length > 280) {
    throw new DomainError("validation_failed", "reason must be at most 280 characters");
  }
  return trimmed.length === 0 ? null : trimmed;
}

/** One request joined to its requester and resolver. */
const REQUEST_SELECT = `
  select r.id, r.amount, r.reason, r.state, r.granted_amount, r.resolution_reason,
         r.resolved_at, r.created_at, r.requester_id,
         req.display_name as requester_display_name, req.invite_level as requester_level,
         rb.id as resolved_by_id, rb.display_name as resolved_by_display_name
    from public.invitation_requests r
    join public.profiles req on req.id = r.requester_id
    left join public.profiles rb on rb.id = r.resolved_by
`;

/** One grant joined to the profile that granted it. */
const GRANT_SELECT = `
  select g.id, g.user_id, g.amount, g.request_id, g.reason, g.revoked_at, g.created_at,
         gb.id as granted_by_id, gb.display_name as granted_by_display_name
    from public.invitation_quota_grants g
    left join public.profiles gb on gb.id = g.granted_by
`;

function toRequestView(row: Record<string, unknown>): InvitationRequestView {
  return {
    id: String(row.id),
    requester: {
      id: String(row.requester_id),
      display_name: String(row.requester_display_name ?? ""),
      level:
        row.requester_level === null || row.requester_level === undefined
          ? null
          : Number(row.requester_level),
    },
    amount: Number(row.amount),
    reason: row.reason === null || row.reason === undefined ? null : String(row.reason),
    state: row.state as InvitationRequestState,
    granted_amount:
      row.granted_amount === null || row.granted_amount === undefined
        ? null
        : Number(row.granted_amount),
    resolution_reason:
      row.resolution_reason === null || row.resolution_reason === undefined
        ? null
        : String(row.resolution_reason),
    resolved_by:
      row.resolved_by_id === null || row.resolved_by_id === undefined
        ? null
        : {
            id: String(row.resolved_by_id),
            display_name: String(row.resolved_by_display_name ?? ""),
          },
    resolved_at: toIsoOrNull(row.resolved_at),
    created_at: toIso(row.created_at),
  };
}

function toGrantView(row: Record<string, unknown>): GrantView {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    amount: Number(row.amount),
    granted_by:
      row.granted_by_id === null || row.granted_by_id === undefined
        ? null
        : {
            id: String(row.granted_by_id),
            display_name: String(row.granted_by_display_name ?? ""),
          },
    request_id: row.request_id === null || row.request_id === undefined ? null : String(row.request_id),
    reason: row.reason === null || row.reason === undefined ? null : String(row.reason),
    revoked_at: toIsoOrNull(row.revoked_at),
    created_at: toIso(row.created_at),
  };
}

async function getInvitationRequest(
  deps: InvitationsDeps,
  id: string,
): Promise<InvitationRequestView> {
  const { rows } = await deps.db.query(`${REQUEST_SELECT} where r.id = $1`, [id]);
  const row = rows[0];
  if (!row) throw new DomainError("not_found");
  return toRequestView(row);
}

async function getGrant(deps: InvitationsDeps, id: string): Promise<GrantView> {
  const { rows } = await deps.db.query(`${GRANT_SELECT} where g.id = $1`, [id]);
  const row = rows[0];
  if (!row) throw new DomainError("not_found");
  return toGrantView(row);
}

/**
 * `POST /me/invitation-requests` — ask an administrator for more seats.
 * Session-only; only allowed once the quota reads exactly zero remaining.
 */
export async function requestInvitationQuota(
  deps: InvitationsDeps,
  caller: Caller,
  input: { amount: number; reason?: string },
): Promise<InvitationRequestView> {
  if (caller.kind !== "session") throw new DomainError("unauthorized");
  const uid = caller.userId;
  const amount = requestAmount(input.amount);
  const reason = optionalReason(input.reason);

  const requestId = await withInviteTx(deps, async (db) => {
    const quota = await invitationQuota(db, uid);
    if (quota.remaining > 0) throw new DomainError("invitation_quota_available");

    const { rows: profileRows } = await db.query(
      "select display_name from public.profiles where id = $1",
      [uid],
    );
    const displayName = String(profileRows[0]?.display_name ?? "");

    // The partial unique index is the real guard under concurrency; this check
    // only turns the common case into a clean error instead of a 23505.
    const { rows: pending } = await db.query(
      "select 1 from public.invitation_requests where requester_id = $1 and state = 'pending'",
      [uid],
    );
    if (pending[0]) throw new DomainError("request_pending");

    let id: string;
    try {
      const { rows } = await db.query(
        `insert into public.invitation_requests (requester_id, amount, reason)
         values ($1, $2, $3)
         returning id`,
        [uid, amount, reason],
      );
      id = String(rows[0]?.id);
    } catch (err) {
      if ((err as { code?: string }).code === "23505") throw new DomainError("request_pending");
      throw err;
    }

    await enqueueEvent(db, {
      type: "invitation.requested",
      target: "admins",
      resource: {
        request_id: id,
        actor_name: displayName,
        amount,
        places: amount,
        level: quota.level,
        remaining: quota.remaining,
      },
      notify: ["push"],
    });
    return id;
  });

  return getInvitationRequest(deps, requestId);
}

/** `POST /me/invitation-requests/{id}/cancel` — withdraw a pending request. */
export async function cancelInvitationRequest(
  deps: InvitationsDeps,
  caller: Caller,
  id: string,
): Promise<void> {
  if (caller.kind !== "session") throw new DomainError("unauthorized");
  const uid = caller.userId;
  const { rows } = await deps.db.query(
    `update public.invitation_requests
        set state = 'cancelled', resolved_at = now()
      where id = $1 and requester_id = $2 and state = 'pending'
      returning id`,
    [id, uid],
  );
  if (rows[0]) return;

  const { rows: existing } = await deps.db.query(
    "select requester_id, state from public.invitation_requests where id = $1",
    [id],
  );
  const row = existing[0];
  // Another user's request is indistinguishable from a missing one.
  if (!row || String(row.requester_id) !== uid) throw new DomainError("not_found");
  throw new DomainError("request_resolved");
}

/** `GET /invitation-requests` — the admin list, pending first, with live quota. */
export async function listInvitationRequests(
  deps: InvitationsDeps,
  page: InvitationRequestPage,
): Promise<{ requests: InvitationRequestListRow[]; total: number }> {
  const state = page.state ?? "all";
  const { rows } = await deps.db.query(
    `with filtered as (
       ${REQUEST_SELECT}
       where $3::text = 'all' or r.state = $3::text
     ),
     total as (select count(*)::int as n from filtered),
     p as (
       select * from filtered
       order by (state = 'pending') desc, created_at desc, id desc
       limit $1 offset $2
     )
     select total.n as total, p.*
       from total left join p on true`,
    [page.limit, page.offset, state],
  );
  const requestRows = rows.filter((row) => row.id !== null && row.id !== undefined);
  const requests: InvitationRequestListRow[] = [];
  for (const row of requestRows) {
    const view = toRequestView(row);
    requests.push({ ...view, quota: await invitationQuota(deps.db, view.requester.id) });
  }
  return { requests, total: Number(rows[0]?.total ?? 0) };
}

/** The caller's own recent requests (`GET /me/invitations` history). */
export async function listOwnInvitationRequests(
  deps: InvitationsDeps,
  userId: string,
  limit: number,
): Promise<InvitationRequestView[]> {
  const { rows } = await deps.db.query(
    `${REQUEST_SELECT} where r.requester_id = $1 order by r.created_at desc, r.id desc limit $2`,
    [userId, limit],
  );
  return rows.map(toRequestView);
}

/**
 * `POST /invitation-requests/{id}/approve` — approve with a seat amount. The
 * conditional update makes the approval single-winner: a second admin racing
 * the same request gets `request_resolved` and never a second grant.
 */
export async function approveInvitationRequest(
  deps: InvitationsDeps,
  caller: Caller,
  id: string,
  amount: number,
): Promise<InvitationRequestView> {
  const actor = actorFor(caller);
  const approved = grantAmount(amount);

  await withInviteTx(deps, async (db) => {
    const { rows } = await db.query(
      `update public.invitation_requests
          set state = 'approved', granted_amount = $2, resolved_by = $3, resolved_at = now()
        where id = $1 and state = 'pending'
        returning id, requester_id`,
      [id, approved, actor.by],
    );
    const row = rows[0];
    if (!row) {
      const { rows: existing } = await db.query(
        "select id from public.invitation_requests where id = $1",
        [id],
      );
      if (!existing[0]) throw new DomainError("not_found");
      throw new DomainError("request_resolved");
    }

    await db.query(
      `insert into public.invitation_quota_grants (user_id, amount, granted_by, granted_by_key, request_id)
       values ($1, $2, $3, $4, $5)`,
      [String(row.requester_id), approved, actor.by, actor.byKey, id],
    );

    await enqueueEvent(db, {
      type: "invitation.request_resolved",
      target: "user",
      subject_id: String(row.requester_id),
      resource: { request_id: id, state: "approved", amount: approved, places: approved },
      notify: ["push"],
    });
  });

  return getInvitationRequest(deps, id);
}

/** `POST /invitation-requests/{id}/reject` — refuse with an optional reason. */
export async function rejectInvitationRequest(
  deps: InvitationsDeps,
  caller: Caller,
  id: string,
  reason?: string,
): Promise<InvitationRequestView> {
  const actor = actorFor(caller);
  const resolution = optionalReason(reason);

  await withInviteTx(deps, async (db) => {
    const { rows } = await db.query(
      `update public.invitation_requests
          set state = 'rejected', resolution_reason = $2, resolved_by = $3, resolved_at = now()
        where id = $1 and state = 'pending'
        returning id, requester_id, amount`,
      [id, resolution, actor.by],
    );
    const row = rows[0];
    if (!row) {
      const { rows: existing } = await db.query(
        "select id from public.invitation_requests where id = $1",
        [id],
      );
      if (!existing[0]) throw new DomainError("not_found");
      throw new DomainError("request_resolved");
    }

    await enqueueEvent(db, {
      type: "invitation.request_resolved",
      target: "user",
      subject_id: String(row.requester_id),
      resource: {
        request_id: id,
        state: "rejected",
        amount: Number(row.amount),
        places: Number(row.amount),
      },
      notify: ["push"],
    });
  });

  return getInvitationRequest(deps, id);
}

/** `POST /users/{id}/invitation-grants` — a direct grant with no request. */
export async function grantInvitationQuota(
  deps: InvitationsDeps,
  caller: Caller,
  userId: string,
  input: { amount: number; reason?: string },
): Promise<GrantView> {
  const actor = actorFor(caller);
  const amount = grantAmount(input.amount);
  const reason = optionalReason(input.reason);

  const { rows } = await deps.db
    .query(
      `insert into public.invitation_quota_grants (user_id, amount, granted_by, granted_by_key, reason)
       values ($1, $2, $3, $4, $5)
       returning id`,
      [userId, amount, actor.by, actor.byKey, reason],
    )
    .catch((err: { code?: string }) => {
      // The member was purged between the authorization and the insert.
      if (err.code === "23503") throw new DomainError("not_found");
      throw err;
    });
  return getGrant(deps, String(rows[0]?.id));
}

/** `GET /users/{id}/invitation-grants` — active and revoked history. */
export async function listInvitationGrants(
  deps: InvitationsDeps,
  userId: string,
): Promise<GrantView[]> {
  const { rows } = await deps.db.query(
    `${GRANT_SELECT} where g.user_id = $1 order by g.created_at desc, g.id desc`,
    [userId],
  );
  return rows.map(toGrantView);
}

/** `DELETE /users/{id}/invitation-grants/{grantId}` — revoke, keeping history. */
export async function revokeInvitationGrant(
  deps: InvitationsDeps,
  caller: Caller,
  userId: string,
  grantId: string,
): Promise<void> {
  actorFor(caller); // authorized at the door; here only to reject an anonymous caller.
  const { rows } = await deps.db.query(
    `update public.invitation_quota_grants
        set revoked_at = now()
      where id = $1 and user_id = $2 and revoked_at is null
      returning id`,
    [grantId, userId],
  );
  if (rows[0]) return;

  const { rows: existing } = await deps.db.query(
    "select user_id from public.invitation_quota_grants where id = $1",
    [grantId],
  );
  const row = existing[0];
  // Another user's grant is indistinguishable from a missing one.
  if (!row || String(row.user_id) !== userId) throw new DomainError("not_found");
  // Already revoked: revocation is idempotent.
}
