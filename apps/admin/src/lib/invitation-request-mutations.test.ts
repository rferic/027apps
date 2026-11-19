import { describe, expect, it, vi } from "vitest";

import {
  approveInvitationRequest,
  fetchPendingRequestCount,
  rejectInvitationRequest,
} from "./invitation-request-mutations";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

describe("approveInvitationRequest", () => {
  it("POSTs the amount and reports a success", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));

    await expect(approveInvitationRequest("r1", 3, fetcher)).resolves.toEqual({ ok: true });
    expect(fetcher).toHaveBeenCalledWith(
      "/api/v1/invitation-requests/r1/approve",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ amount: 3 }) }),
    );
  });

  it("preserves the request_resolved code when a second admin clicks", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      json({ error: { code: "request_resolved", request_id: "req-409" } }, 409),
    );

    await expect(approveInvitationRequest("r1", 3, fetcher)).resolves.toEqual({
      ok: false,
      code: "request_resolved",
      requestId: "req-409",
    });
  });
});

describe("rejectInvitationRequest", () => {
  it("POSTs the reason and reports a success", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));

    await expect(rejectInvitationRequest("r1", "Not this month", fetcher)).resolves.toEqual({
      ok: true,
    });
    expect(fetcher).toHaveBeenCalledWith(
      "/api/v1/invitation-requests/r1/reject",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ reason: "Not this month" }) }),
    );
  });

  it("omits the reason body when none is given", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));

    await rejectInvitationRequest("r1", undefined, fetcher);
    expect(fetcher).toHaveBeenCalledWith(
      "/api/v1/invitation-requests/r1/reject",
      expect.objectContaining({ body: JSON.stringify({}) }),
    );
  });
});

describe("fetchPendingRequestCount", () => {
  it("reads the pending total", async () => {
    const fetcher = vi.fn().mockResolvedValue(json({ requests: [], total: 3 }));

    await expect(fetchPendingRequestCount(fetcher)).resolves.toBe(3);
    expect(fetcher).toHaveBeenCalledWith(
      "/api/v1/invitation-requests?state=pending&limit=1",
      expect.objectContaining({ credentials: "same-origin" }),
    );
  });

  it("returns zero on a failure or an unreadable body", async () => {
    await expect(
      fetchPendingRequestCount(vi.fn().mockResolvedValue(new Response(null, { status: 500 }))),
    ).resolves.toBe(0);

    await expect(
      fetchPendingRequestCount(vi.fn().mockResolvedValue(json({ requests: [] }))),
    ).resolves.toBe(0);
  });
});
