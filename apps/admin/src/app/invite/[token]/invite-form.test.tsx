import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
}));

vi.mock("./actions", () => ({
  submitInvitation: vi.fn(async () => ({ ok: true, role: "user" })),
}));

import type { InvitePublicView } from "./invite-details";
import { InviteFailureAlert, InviteForm, fieldProps } from "./invite-form";

const TOKEN = "027_inv_abc123";
const VIEW: InvitePublicView = {
  email: "ana@example.com",
  name: "Ana",
  role: "user",
  role_applies: true,
  account_exists: false,
  inviter_name: "Eric",
  instance_name: "Familia Pérez",
  expires_at: "2026-11-24T12:00:00.000Z",
  timezone: "Europe/Madrid",
  locale: "es",
};

function form(view: InvitePublicView = VIEW) {
  return <InviteForm token={TOKEN} view={view} messages={{}} />;
}

describe("InviteForm", () => {
  it("leaves the invitation card to the wizard, so it renders once", () => {
    const html = renderToStaticMarkup(form());

    expect(html).not.toContain("ana@example.com");
    expect(html).not.toContain("Familia Pérez");
    expect(html).not.toContain('name="email"');
    expect(html).not.toContain('name="name"');
  });

  it("asks for a password and its confirmation on a new account", () => {
    const html = renderToStaticMarkup(form());

    expect(html).toContain("<form");
    expect(html).toContain('name="password"');
    expect(html).toContain('name="confirmation"');
    expect(html).toContain('autoComplete="new-password"');
    expect(html).toContain('minLength="12"');
    expect(html).toContain('maxLength="200"');
    expect(html).toContain("Accept invitation");
  });

  it("asks only for the current password on an existing account", () => {
    const html = renderToStaticMarkup(form({ ...VIEW, account_exists: true, role_applies: false }));

    expect(html).toContain('autoComplete="current-password"');
    expect(html).not.toContain('name="confirmation"');
    expect(html).toContain("Sign in and accept");
    expect(html).toContain('href="/forgot-password"');
  });

  it("links to the login page as the way out", () => {
    expect(renderToStaticMarkup(form())).toContain('href="/login"');
  });
});

describe("fieldProps", () => {
  it("announces the hint and the error together when both apply", () => {
    expect(fieldProps("password", { password: "password_short" }, "invite-password-hint")).toEqual({
      "aria-invalid": true,
      "aria-describedby": "invite-password-hint invite-password-error",
    });
  });

  it("keeps the hint reachable before the error appears", () => {
    expect(fieldProps("password", {}, "invite-password-hint")).toEqual({
      "aria-describedby": "invite-password-hint",
    });
  });

  it("marks a field without a hint as invalid and points at its error", () => {
    expect(fieldProps("confirmation", { confirmation: "password_mismatch" })).toEqual({
      "aria-invalid": true,
      "aria-describedby": "invite-confirmation-error",
    });
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

  it("offers the recovery path when the existing password is wrong", () => {
    const html = renderToStaticMarkup(
      <InviteFailureAlert failure={{ ok: false, code: "wrong_credentials" }} messages={{}} />,
    );

    expect(html).toContain("The password is not correct.");
    expect(html).toContain('href="/forgot-password"');
  });
});
