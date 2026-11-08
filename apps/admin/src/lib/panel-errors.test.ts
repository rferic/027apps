import { describe, expect, it } from "vitest";
import { invitationConflictError, panelErrorCodeLabel, slugConflictError } from "./panel-errors";

describe("invitationConflictError", () => {
  it("names a registered member as the cause of a create conflict", () => {
    expect(
      invitationConflictError({ code: "conflict", details: { code: "email_registered" } }, {}),
    ).toBe("That email already belongs to a member.");
  });

  it("names the pending invitation as the cause of a create conflict", () => {
    expect(
      invitationConflictError({ code: "conflict", details: { code: "pending_invitation" } }, {}),
    ).toBe("That email already has a pending invitation.");
  });

  it("leaves a conflict without a known detail code to the generic alert", () => {
    expect(invitationConflictError({ code: "conflict" }, {})).toBeUndefined();
    expect(invitationConflictError({ code: "conflict", details: {} }, {})).toBeUndefined();
    expect(
      invitationConflictError({ code: "conflict", details: { code: "other" } }, {}),
    ).toBeUndefined();
    expect(
      invitationConflictError({ code: "internal", details: { code: "email_registered" } }, {}),
    ).toBeUndefined();
    expect(invitationConflictError(null, {})).toBeUndefined();
  });
});

describe("slugConflictError", () => {
  it("names the slug as the cause of a create conflict", () => {
    expect(slugConflictError({ code: "conflict" }, {})).toBe(
      "A category with that slug already exists.",
    );
  });

  it("leaves other failures to the generic alert", () => {
    expect(slugConflictError({ code: "internal" }, {})).toBeUndefined();
    expect(slugConflictError({}, {})).toBeUndefined();
    expect(slugConflictError(null, {})).toBeUndefined();
  });
});

describe("panelErrorCodeLabel", () => {
  it("maps the shared codes from every panel area in one place", () => {
    expect(panelErrorCodeLabel("internal", {})).toBe(
      "Something went wrong on the server.",
    );
    expect(panelErrorCodeLabel("insufficient_scope", {})).toBe(
      "You do not have permission to do that.",
    );
    expect(panelErrorCodeLabel("invitation_used", {})).toBe(
      "This invitation has already been used.",
    );
    expect(panelErrorCodeLabel("currency_is_default", {})).toBe(
      "The default currency cannot be disabled.",
    );
  });

  it("keeps an unknown code visible instead of hiding it", () => {
    expect(panelErrorCodeLabel("new_code", {})).toBe("Unexpected error: new_code");
  });
});
