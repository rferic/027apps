import { describe, expect, it } from "vitest";
import {
  buildProfilePatch,
  canAssignRole,
  deactivationCopy,
  roleOptions,
} from "./member-form";

const MEMBER = {
  id: "u1",
  display_name: "Ana",
  email: "ana@example.com",
  locale: "es",
  timezone: "Europe/Madrid",
  role: "admin" as const,
  created_at: "2026-01-01T00:00:00.000Z",
  deactivated_at: null,
};

const VALUES = {
  display_name: "Ana María",
  locale: "es",
  timezone: "Europe/Madrid",
  role: "admin" as const,
};

describe("buildProfilePatch", () => {
  it("sends the profile fields and omits an unchanged role", () => {
    expect(buildProfilePatch(MEMBER, VALUES)).toEqual({
      display_name: "Ana María",
      locale: "es",
      timezone: "Europe/Madrid",
    });
  });

  it("includes the role only when it actually changes", () => {
    expect(buildProfilePatch(MEMBER, { ...VALUES, role: "user" })).toEqual({
      display_name: "Ana María",
      locale: "es",
      timezone: "Europe/Madrid",
      role: "user",
    });
  });
});

describe("role controls", () => {
  it("lets a super_admin assign every role and an admin only admin/user", () => {
    expect(roleOptions("super_admin")).toEqual(["super_admin", "admin", "user"]);
    expect(roleOptions("admin")).toEqual(["admin", "user"]);
  });

  it("never offers an admin a role change on a super_admin", () => {
    expect(canAssignRole("admin", "super_admin")).toBe(false);
    expect(canAssignRole("admin", "admin")).toBe(true);
    expect(canAssignRole("super_admin", "super_admin")).toBe(true);
  });
});

describe("deactivationCopy", () => {
  it("names the member and the consequence, never a bare confirmation", () => {
    const copy = deactivationCopy("Sara", {});

    expect(copy.title).toBe("Deactivate Sara?");
    expect(copy.consequence).toContain("Sara");
    expect(copy.consequence).toContain("will lose access immediately.");
    expect(copy.note).toContain("cannot be undone");
  });

  it("translates the copy when the panel has a dictionary", () => {
    const copy = deactivationCopy("Sara", {
      "Deactivate {name}?": "¿Desactivar a {name}?",
      "{name} will lose access immediately.": "{name} perderá el acceso de inmediato.",
    });

    expect(copy.title).toBe("¿Desactivar a Sara?");
    expect(copy.consequence).toBe("Sara perderá el acceso de inmediato.");
  });
});
