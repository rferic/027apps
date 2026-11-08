import { describe, expect, it } from "vitest";
import { MACHINE_SCOPES } from "@027apps/core/auth/guard.js";
import {
  ALL_API_KEY_SCOPES,
  API_KEY_SCOPE_GROUPS,
  allowedApiKeyScopes,
} from "./api-key-scopes";

const offered = (kind: "service" | "delegated", cap: "" | "admin" | "super_admin" = "") =>
  API_KEY_SCOPE_GROUPS.flatMap((group) => group.scopes).filter((scope) =>
    allowedApiKeyScopes(kind, cap).includes(scope),
  );

describe("allowedApiKeyScopes", () => {
  it("offers exactly the delegated allowlist, never administration scopes", () => {
    const scopes = allowedApiKeyScopes("delegated", "");

    expect([...scopes].sort()).toEqual([...MACHINE_SCOPES.delegated].sort());
    for (const forbidden of [
      "settings:read",
      "settings:write",
      "currencies:write",
      "users:write",
      "users:deactivate",
      "roles:assign",
      "user_categories:write",
      "invitations:read",
      "invitations:write",
      "modules:grant",
      "modules:manage",
      "maintenance:run",
    ]) {
      expect(scopes).not.toContain(forbidden);
    }
    expect(scopes).toContain("users:read");
    expect(scopes).toContain("user_categories:read");
    expect(scopes).toContain("api_keys:write");
  });

  it("offers the service set for each cap and excludes personal scopes", () => {
    expect([...allowedApiKeyScopes("service", "admin")].sort()).toEqual(
      [...MACHINE_SCOPES.service.admin].sort(),
    );
    expect([...allowedApiKeyScopes("service", "super_admin")].sort()).toEqual(
      [...MACHINE_SCOPES.service.super_admin].sort(),
    );
    for (const cap of ["admin", "super_admin"] as const) {
      const scopes = allowedApiKeyScopes("service", cap);
      expect(scopes).not.toContain("profile:read");
      expect(scopes).not.toContain("devices:read");
    }
  });

  it("reserves maintenance:run and users:deactivate for the super_admin service cap", () => {
    expect(allowedApiKeyScopes("service", "admin")).not.toContain("maintenance:run");
    expect(allowedApiKeyScopes("service", "admin")).not.toContain("users:deactivate");
    expect(allowedApiKeyScopes("service", "super_admin")).toContain("maintenance:run");
    expect(allowedApiKeyScopes("service", "super_admin")).toContain("users:deactivate");
  });
});

describe("scope groups", () => {
  it("only offers groups with at least one allowed scope", () => {
    const hidden = API_KEY_SCOPE_GROUPS.filter(
      (group) => offered("delegated").some((scope) => group.scopes.includes(scope)) === false,
    ).map((group) => group.id);

    expect(hidden).toContain("settings");
    expect(hidden).toContain("invitations");
    expect(hidden).toContain("maintenance");
    expect(hidden).not.toContain("profile");
    expect(hidden).not.toContain("devices");
  });

  it("keeps every group scope inside some allowlist", () => {
    for (const scope of ALL_API_KEY_SCOPES) {
      const used =
        allowedApiKeyScopes("delegated", "").includes(scope) ||
        allowedApiKeyScopes("service", "super_admin").includes(scope);
      expect(used).toBe(true);
    }
  });
});
