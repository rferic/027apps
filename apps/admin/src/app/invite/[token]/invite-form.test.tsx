import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
}));

import { InviteFailureAlert, InviteForm } from "./invite-form";

const TOKEN = "027_inv_abc123";

function form() {
  return <InviteForm token={TOKEN} messages={{}} />;
}

describe("InviteForm", () => {
  it("renders email, password and confirmation with the Core limits", () => {
    const html = renderToStaticMarkup(form());

    expect(html).toContain("<form");
    expect(html).toContain('for="invite-email"');
    expect(html).toContain('id="invite-email"');
    expect(html).toContain('type="email"');
    expect(html).toContain('autoComplete="email"');
    expect(html).toContain('name="password"');
    expect(html).toContain('name="confirmation"');
    expect(html).toContain('autoComplete="new-password"');
    expect(html).toContain('minLength="12"');
    expect(html).toContain('maxLength="200"');
    expect(html).toContain("Accept invitation");
  });

  it("does not ask for a name", () => {
    const html = renderToStaticMarkup(form());

    expect(html).not.toContain('name="name"');
    expect(html).not.toContain("Display name");
  });

  it("links to the login page as the way out", () => {
    const html = renderToStaticMarkup(form());

    expect(html).toContain('href="/login"');
  });
});

describe("InviteFailureAlert", () => {
  it("names a retry for a network failure and keeps the request id for support", () => {
    const html = renderToStaticMarkup(
      <InviteFailureAlert failure={{ ok: false, requestId: "req-42" }} messages={{}} />,
    );

    expect(html).toContain('role="alert"');
    expect(html).toContain(
      "We couldn&#x27;t redeem this invitation. Check your connection and try again.",
    );
    expect(html).toContain("req-42");
  });

  it("does not distinguish a revoked invitation from a missing one", () => {
    const html = renderToStaticMarkup(
      <InviteFailureAlert failure={{ ok: false, code: "not_found" }} messages={{}} />,
    );

    expect(html).toContain("This invitation link is not valid.");
  });

  it("sends an already used invitation to the login page", () => {
    const html = renderToStaticMarkup(
      <InviteFailureAlert failure={{ ok: false, code: "invitation_used" }} messages={{}} />,
    );

    expect(html).toContain("This invitation has already been used.");
    expect(html).toContain('href="/login"');
    expect(html).toContain("Sign in");
  });

  it("explains an expired invitation", () => {
    const html = renderToStaticMarkup(
      <InviteFailureAlert failure={{ ok: false, code: "invitation_expired" }} messages={{}} />,
    );

    expect(html).toContain("This invitation has expired. Ask an administrator for a new one.");
  });

  it("explains a deactivated account", () => {
    const html = renderToStaticMarkup(
      <InviteFailureAlert failure={{ ok: false, code: "conflict" }} messages={{}} />,
    );

    expect(html).toContain("This account is deactivated. Contact an administrator.");
  });

  it("asks for the invited email without revealing it", () => {
    const html = renderToStaticMarkup(
      <InviteFailureAlert failure={{ ok: false, code: "validation_failed" }} messages={{}} />,
    );

    expect(html).toContain("Use the email address this invitation was sent to.");
  });

  it("asks the user to wait after rate limiting", () => {
    const html = renderToStaticMarkup(
      <InviteFailureAlert failure={{ ok: false, code: "rate_limited" }} messages={{}} />,
    );

    expect(html).toContain("Too many attempts. Wait a minute and try again.");
  });
});
