import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Caller } from "../api/types.js";
import type { QueryClient } from "../api/rate-limit-storage.js";
import type { InvitationsDeps } from "./service.js";

const { invitationQuotaMock, enqueueEventMock } = vi.hoisted(() => ({
  invitationQuotaMock: vi.fn(),
  enqueueEventMock: vi.fn(),
}));

vi.mock("./quota.js", () => ({
  invitationQuota: invitationQuotaMock,
  parseInvitationLevels: () => [],
  baseQuotaFor: () => 0,
}));

vi.mock("../realtime/service.js", () => ({
  enqueueEvent: enqueueEventMock,
}));

import {
  approveInvitationRequest,
  cancelInvitationRequest,
  grantInvitationQuota,
  listInvitationGrants,
  listInvitationRequests,
  listOwnInvitationRequests,
  rejectInvitationRequest,
  requestInvitationQuota,
  revokeInvitationGrant,
} from "./requests.js";

const SESSION: Caller = { kind: "session", userId: "u-1", role: "user" };
const ADMIN: Caller = { kind: "session", userId: "admin-1", role: "admin" };
const NOW = new Date("2026-11-19T12:00:00.000Z");

/** A request row as `REQUEST_SELECT` returns it (joined requester + resolver). */
const REQUEST_ROW = {
  id: "req-1",
  amount: 3,
  reason: "family is growing",
  state: "pending",
  granted_amount: null,
  resolution_reason: null,
  resolved_at: null,
  created_at: "2026-11-19T11:00:00.000Z",
  requester_id: "u-1",
  requester_display_name: "Eric",
  requester_level: 1,
  resolved_by_id: null,
  resolved_by_display_name: null,
};

interface RecordedQuery {
  sql: string;
  params: unknown[];
}

/** Records every query and answers by matching the SQL against a handler map. */
function fakeDb(handlers: Record<string, (params: unknown[]) => unknown[]>): {
  db: QueryClient;
  queries: RecordedQuery[];
} {
  const queries: RecordedQuery[] = [];
  const db: QueryClient = {
    async query(sql: string, params: unknown[] = []) {
      queries.push({ sql, params });
      for (const [needle, respond] of Object.entries(handlers)) {
        if (sql.includes(needle)) {
          return { rows: respond(params) as Record<string, unknown>[] };
        }
      }
      return { rows: [] };
    },
  };
  return { db, queries };
}

function deps(db: QueryClient): InvitationsDeps {
  return {
    db,
    auth: {
      async findUserByEmail() {
        return null;
      },
      async createUser() {
        return { id: "u-new", created: true };
      },
      async deleteUser() {},
    },
    now: () => NOW,
  };
}

/** A quota with no seats left: the only state that admits a request. */
const EXHAUSTED_QUOTA = {
  level: 1,
  base: 0,
  granted: 0,
  used: 0,
  reserved: 0,
  remaining: 0,
  unlimited: false,
};

beforeEach(() => {
  invitationQuotaMock.mockReset();
  enqueueEventMock.mockReset();
  enqueueEventMock.mockResolvedValue(undefined);
});

describe("requestInvitationQuota", () => {
  it("refuses a request while the caller still has seats", async () => {
    invitationQuotaMock.mockResolvedValue({ ...EXHAUSTED_QUOTA, remaining: 3 });
    const { db } = fakeDb({});

    await expect(requestInvitationQuota(deps(db), SESSION, { amount: 2 })).rejects.toMatchObject({
      code: "invitation_quota_available",
    });
    expect(enqueueEventMock).not.toHaveBeenCalled();
  });

  it("refuses a non-session caller", async () => {
    const { db } = fakeDb({});
    await expect(
      requestInvitationQuota(deps(db), { kind: "anon" }, { amount: 2 }),
    ).rejects.toMatchObject({ code: "unauthorized" });
  });

  it("keeps one pending request and allows another after cancelling", async () => {
    invitationQuotaMock.mockResolvedValue(EXHAUSTED_QUOTA);
    let hasPending = false;
    const { db } = fakeDb({
      "select display_name from public.profiles": () => [{ display_name: "Eric" }],
      "select 1 from public.invitation_requests": () => (hasPending ? [{ exists: 1 }] : []),
      "insert into public.invitation_requests": () => [{ id: "req-1", created_at: NOW.toISOString() }],
      "set state = 'cancelled'": () => [{ id: "req-1" }],
      "from public.invitation_requests r": () => [REQUEST_ROW],
    });

    await requestInvitationQuota(deps(db), SESSION, { amount: 2, reason: "family" });
    hasPending = true;
    await expect(requestInvitationQuota(deps(db), SESSION, { amount: 3 })).rejects.toMatchObject({
      code: "request_pending",
    });

    await cancelInvitationRequest(deps(db), SESSION, "req-1");
    hasPending = false;
    await expect(requestInvitationQuota(deps(db), SESSION, { amount: 4 })).resolves.toBeDefined();
  });

  it("enqueues invitation.requested to admins with the requester and amount", async () => {
    invitationQuotaMock.mockResolvedValue(EXHAUSTED_QUOTA);
    const { db } = fakeDb({
      "select display_name from public.profiles": () => [{ display_name: "Eric" }],
      "select 1 from public.invitation_requests": () => [],
      "insert into public.invitation_requests": () => [{ id: "req-1", created_at: NOW.toISOString() }],
      "from public.invitation_requests r": () => [REQUEST_ROW],
    });

    const view = await requestInvitationQuota(deps(db), SESSION, { amount: 5, reason: "more people" });

    expect(view).toMatchObject({ id: "req-1", state: "pending" });
    expect(enqueueEventMock).toHaveBeenCalledWith(expect.anything(), {
      type: "invitation.requested",
      target: "admins",
      resource: {
        request_id: "req-1",
        actor_name: "Eric",
        amount: 5,
        places: 5,
        level: 1,
        remaining: 0,
      },
      notify: ["push"],
    });
  });
});

describe("approveInvitationRequest", () => {
  it("creates one grant with the approved amount and emits request_resolved", async () => {
    const { db, queries } = fakeDb({
      "set state = 'approved'": () => [{ id: "req-1", requester_id: "u-1" }],
      "insert into public.invitation_quota_grants": () => [{ id: "grant-1" }],
      "from public.invitation_requests r": () => [
        { ...REQUEST_ROW, state: "approved", granted_amount: 7, resolved_at: NOW.toISOString() },
      ],
    });

    const view = await approveInvitationRequest(deps(db), ADMIN, "req-1", 7);

    expect(view).toMatchObject({ id: "req-1", state: "approved", granted_amount: 7 });

    const grant = queries.find((q) => q.sql.includes("insert into public.invitation_quota_grants"));
    // (user_id, amount, granted_by, granted_by_key, request_id)
    expect(grant?.params).toEqual(["u-1", 7, "admin-1", null, "req-1"]);

    expect(enqueueEventMock).toHaveBeenCalledWith(expect.anything(), {
      type: "invitation.request_resolved",
      target: "user",
      subject_id: "u-1",
      resource: { request_id: "req-1", state: "approved", amount: 7, places: 7 },
      notify: ["push"],
    });
  });

  it("approves once when two admins click at the same time", async () => {
    const { db } = fakeDb({
      "set state = 'approved'": () => [],
      "select id from public.invitation_requests": () => [{ id: "req-1" }],
    });

    await expect(approveInvitationRequest(deps(db), ADMIN, "req-1", 7)).rejects.toMatchObject({
      code: "request_resolved",
    });
    expect(enqueueEventMock).not.toHaveBeenCalled();
  });
});

describe("rejectInvitationRequest", () => {
  it("rejects with a reason and never grants", async () => {
    const { db, queries } = fakeDb({
      "set state = 'rejected'": () => [{ id: "req-1", requester_id: "u-1", amount: 3 }],
      "from public.invitation_requests r": () => [
        { ...REQUEST_ROW, state: "rejected", resolution_reason: "not now" },
      ],
    });

    const view = await rejectInvitationRequest(deps(db), ADMIN, "req-1", "not now");

    expect(view).toMatchObject({ id: "req-1", state: "rejected", resolution_reason: "not now" });
    expect(queries.find((q) => q.sql.includes("insert into public.invitation_quota_grants"))).toBeUndefined();
    expect(enqueueEventMock).toHaveBeenCalledWith(expect.anything(), {
      type: "invitation.request_resolved",
      target: "user",
      subject_id: "u-1",
      resource: { request_id: "req-1", state: "rejected", amount: 3, places: 3 },
      notify: ["push"],
    });
  });
});

describe("cancelInvitationRequest", () => {
  it("hides another user's request behind not_found and reports a resolved one", async () => {
    const { db } = fakeDb({
      "set state = 'cancelled'": () => [],
      "select requester_id, state from public.invitation_requests": () => [
        { requester_id: "someone-else", state: "pending" },
      ],
    });
    await expect(cancelInvitationRequest(deps(db), SESSION, "req-1")).rejects.toMatchObject({
      code: "not_found",
    });
  });
});

describe("grants", () => {
  it("lists and revokes grants without deleting history", async () => {
    const { db, queries } = fakeDb({
      "insert into public.invitation_quota_grants": () => [
        { id: "grant-1", user_id: "u-1", amount: 4, granted_by: "admin-1", request_id: null, reason: null, revoked_at: null, created_at: NOW.toISOString(), granted_by_display_name: "Ada" },
      ],
      "from public.invitation_quota_grants g": () => [
        { id: "grant-1", user_id: "u-1", amount: 4, granted_by_id: "admin-1", granted_by_display_name: "Ada", request_id: null, reason: null, revoked_at: null, created_at: NOW.toISOString() },
      ],
      "set revoked_at = now()": () => [{ id: "grant-1" }],
    });

    const created = await grantInvitationQuota(deps(db), ADMIN, "u-1", { amount: 4 });
    expect(created).toMatchObject({ id: "grant-1", user_id: "u-1", amount: 4 });

    await revokeInvitationGrant(deps(db), ADMIN, "u-1", "grant-1");

    // Revocation is an update, never a delete.
    expect(queries.find((q) => q.sql.includes("delete from public.invitation_quota_grants"))).toBeUndefined();

    const listed = await listInvitationGrants(deps(db), "u-1");
    expect(listed).toHaveLength(1);
    expect(listed[0]).toMatchObject({ id: "grant-1", user_id: "u-1", amount: 4 });
  });

  it("revoking another user's grant is a 404", async () => {
    const { db } = fakeDb({
      "set revoked_at = now()": () => [],
      "select user_id from public.invitation_quota_grants": () => [{ user_id: "someone-else" }],
    });
    await expect(revokeInvitationGrant(deps(db), ADMIN, "u-1", "grant-1")).rejects.toMatchObject({
      code: "not_found",
    });
  });
});

describe("lists", () => {
  it("lists the caller's own requests newest first", async () => {
    const { db, queries } = fakeDb({
      "from public.invitation_requests r": () => [REQUEST_ROW],
    });

    const requests = await listOwnInvitationRequests(deps(db), "u-1", 10);

    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({ id: "req-1" });
    const read = queries.find((q) => q.sql.includes("from public.invitation_requests r"))!;
    expect(read.params).toEqual(["u-1", 10]);
  });

  it("lists pending requests first with the requester's live quota", async () => {
    invitationQuotaMock.mockResolvedValue(EXHAUSTED_QUOTA);
    const { db } = fakeDb({
      "with filtered as": () => [
        { total: 1, ...REQUEST_ROW },
      ],
    });

    const result = await listInvitationRequests(deps(db), { limit: 20, offset: 0, state: "all" });

    expect(result.total).toBe(1);
    expect(result.requests).toHaveLength(1);
    expect(result.requests[0]).toMatchObject({ id: "req-1", quota: EXHAUSTED_QUOTA });
  });
});
