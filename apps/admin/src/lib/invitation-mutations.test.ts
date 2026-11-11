import { describe, expect, it, vi } from "vitest";
import {
  createInvitation,
  regenerateInvitationLink,
  resendInvitationEmail,
  revokeInvitation,
} from "./invitation-mutations";

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers });
}

function call(fetcher: ReturnType<typeof vi.fn>): [string, RequestInit] {
  return fetcher.mock.calls[0] as unknown as [string, RequestInit];
}

describe("createInvitation", () => {
  it("POSTs the allowed fields and returns the one-time token", async () => {
    const fetcher = vi.fn(async () =>
      json({ invitation: { id: "i1", status: "pending" }, token: "027_inv_abc" }, 201),
    );

    const result = await createInvitation(
      {
        email: "ana@example.com",
        name: "Ana",
        user_category_id: "c1",
        modules: ["expenses", "balances"],
        expires_in_days: 7,
      },
      fetcher,
    );

    expect(result).toEqual({ ok: true, token: "027_inv_abc", invitationId: "i1" });
    const [url, init] = call(fetcher);
    expect(url).toBe("/api/v1/invitations");
    expect(init.method).toBe("POST");
    expect(init.credentials).toBe("same-origin");
    expect(init.headers).toEqual({ "content-type": "application/json" });
    expect(JSON.parse(String(init.body))).toEqual({
      email: "ana@example.com",
      name: "Ana",
      user_category_id: "c1",
      modules: ["expenses", "balances"],
      expires_in_days: 7,
    });
  });

  it("never invents a token when the API does not return one", async () => {
    const fetcher = vi.fn(async () => json({ invitation: { id: "i1" } }, 201));

    await expect(createInvitation({ email: "ana@example.com", name: "Ana" }, fetcher)).resolves.toEqual({
      ok: true,
      invitationId: "i1",
    });
  });

  it("omits empty optional fields from the body", async () => {
    const fetcher = vi.fn(async () => json({ invitation: { id: "i1" } }, 201));

    await createInvitation({ email: "ana@example.com", name: "Ana", modules: [] }, fetcher);

    expect(JSON.parse(String(call(fetcher)[1].body))).toEqual({
      email: "ana@example.com",
      name: "Ana",
    });
  });

  it("returns the field errors of a validation failure", async () => {
    const fetcher = vi.fn(async () =>
      json(
        {
          error: {
            code: "validation_failed",
            request_id: "req-400",
            details: { fieldErrors: { email: ["Invalid email"] } },
          },
        },
        400,
      ),
    );

    await expect(createInvitation({ email: "nope", name: "Ana" }, fetcher)).resolves.toEqual({
      ok: false,
      code: "validation_failed",
      requestId: "req-400",
      details: { fieldErrors: { email: ["Invalid email"] } },
    });
  });

  it("keeps the conflict detail code the form maps next to the email", async () => {
    const fetcher = vi.fn(async () =>
      json(
        {
          error: {
            code: "conflict",
            message: "State conflict",
            request_id: "req-409",
            details: { code: "email_registered" },
          },
        },
        409,
      ),
    );

    await expect(createInvitation({ email: "ana@example.com", name: "Ana" }, fetcher)).resolves.toEqual(
      {
        ok: false,
        code: "conflict",
        requestId: "req-409",
        details: { code: "email_registered" },
      },
    );
  });

  it("does not treat a 201 HTML page as success", async () => {
    const fetcher = vi.fn(async () => new Response("<html></html>", { status: 201 }));

    await expect(createInvitation({ email: "ana@example.com", name: "Ana" }, fetcher)).resolves.toEqual({
      ok: false,
    });
  });
});

describe("revokeInvitation", () => {
  it("DELETEs the invitation endpoint", async () => {
    const fetcher = vi.fn(async () => new Response(null, { status: 204 }));

    await expect(revokeInvitation("i1", fetcher)).resolves.toEqual({ ok: true });

    const [url, init] = call(fetcher);
    expect(url).toBe("/api/v1/invitations/i1");
    expect(init.method).toBe("DELETE");
    expect(init.credentials).toBe("same-origin");
  });

  it("keeps the error code of a used invitation", async () => {
    const fetcher = vi.fn(async () =>
      json({ error: { code: "invitation_used", request_id: "req-409" } }, 409),
    );

    await expect(revokeInvitation("i1", fetcher)).resolves.toEqual({
      ok: false,
      code: "invitation_used",
      requestId: "req-409",
    });
  });
});

describe("resendInvitationEmail", () => {
  it("POSTs to the resend endpoint and keeps the email outcome", async () => {
    const fetcher = vi.fn(async () =>
      json({ token: "027_inv_new", email: { status: "sent" } }),
    );

    const result = await resendInvitationEmail("i1", fetcher);

    expect(result).toEqual({ ok: true, token: "027_inv_new", email: { status: "sent" } });
    const [url, init] = call(fetcher);
    expect(url).toBe("/api/v1/invitations/i1/resend-email");
    expect(init.method).toBe("POST");
  });

  it("returns a token even when the provider failed", async () => {
    const fetcher = vi.fn(async () =>
      json({ token: "027_inv_new", email: { status: "failed", code: "email_timeout" } }),
    );

    await expect(resendInvitationEmail("i1", fetcher)).resolves.toEqual({
      ok: true,
      token: "027_inv_new",
      email: { status: "failed", code: "email_timeout" },
    });
  });

  it("maps a 429 to the failure envelope", async () => {
    const fetcher = vi.fn(async () =>
      json({ error: { code: "rate_limited", request_id: "req-1" } }, 429),
    );

    await expect(resendInvitationEmail("i1", fetcher)).resolves.toMatchObject({
      ok: false,
      code: "rate_limited",
      requestId: "req-1",
    });
  });
});

describe("regenerateInvitationLink", () => {
  it("POSTs to the link endpoint and returns the new token", async () => {
    const fetcher = vi.fn(async () => json({ token: "027_inv_link" }));

    await expect(regenerateInvitationLink("i1", fetcher)).resolves.toEqual({
      ok: true,
      token: "027_inv_link",
    });
    expect(call(fetcher)[0]).toBe("/api/v1/invitations/i1/link");
  });

  it("rejects an expired invitation with its code", async () => {
    const fetcher = vi.fn(async () =>
      json({ error: { code: "invitation_expired" } }, 409),
    );

    await expect(regenerateInvitationLink("i1", fetcher)).resolves.toMatchObject({
      ok: false,
      code: "invitation_expired",
    });
  });
});
