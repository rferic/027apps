import { describe, expect, it } from "vitest";
import { allowedApiKeyScopes } from "@/lib/api-key-scopes";
import {
  buildApiKeyUpdateInput,
  mergeKeyScopes,
  selectAllKeyScopes,
  splitKeyScopes,
  toDateTimeLocal,
  toggleKeyScope,
} from "./api-key-edit";

describe("splitKeyScopes", () => {
  it("separates the Core scopes from the module scopes it cannot edit", () => {
    const allowed = allowedApiKeyScopes("delegated", "");

    const { editable, preserved } = splitKeyScopes(
      ["profile:read", "recetas:read_write"],
      allowed,
    );

    expect(editable).toEqual(["profile:read"]);
    expect(preserved).toEqual(["recetas:read_write"]);
  });
});

describe("mergeKeyScopes", () => {
  it("always keeps the preserved module scopes and drops unknown selection", () => {
    const allowed = allowedApiKeyScopes("delegated", "");

    expect(
      mergeKeyScopes(["recetas:read_write"], ["profile:read", "settings:write"], allowed),
    ).toEqual(["recetas:read_write", "profile:read"]);
  });
});

describe("toggleKeyScope", () => {
  it("adds an allowed scope and removes it when unchecked", () => {
    const allowed = allowedApiKeyScopes("delegated", "");

    const selected = toggleKeyScope([], "profile:read", true, allowed);
    expect(selected).toEqual(["profile:read"]);
    expect(toggleKeyScope(selected, "profile:read", false, allowed)).toEqual([]);
  });

  it("never adds a scope outside the key allowlist", () => {
    const allowed = allowedApiKeyScopes("delegated", "");

    expect(toggleKeyScope([], "settings:write", true, allowed)).toEqual([]);
  });

  it("does not duplicate an already selected scope", () => {
    const allowed = allowedApiKeyScopes("delegated", "");

    expect(toggleKeyScope(["profile:read"], "profile:read", true, allowed)).toEqual([
      "profile:read",
    ]);
  });
});

describe("selectAllKeyScopes", () => {
  it("selects exactly the delegated allowlist, never an administration scope", () => {
    const allowed = allowedApiKeyScopes("delegated", "");

    const selected = selectAllKeyScopes(allowed);

    expect(selected).toEqual([...allowed]);
    expect(selected).not.toContain("settings:write");
    expect(selected).not.toContain("maintenance:run");
  });

  it("selects exactly the service allowlist for its cap", () => {
    const allowed = allowedApiKeyScopes("service", "admin");

    const selected = selectAllKeyScopes(allowed);

    expect(selected).toEqual([...allowed]);
    expect(selected).not.toContain("maintenance:run");
  });
});

describe("toDateTimeLocal", () => {
  it("keeps the instant down to the minute", () => {
    const iso = "2027-01-02T03:04:00.000Z";

    const local = toDateTimeLocal(iso);

    expect(local).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    expect(new Date(local).toISOString()).toBe(iso);
  });

  it("is empty when the key never expires", () => {
    expect(toDateTimeLocal(null)).toBe("");
  });
});

describe("buildApiKeyUpdateInput", () => {
  it("sends the trimmed name and every scope it receives, preserved ones included", () => {
    expect(
      buildApiKeyUpdateInput({
        name: "  Renamed  ",
        scopes: ["recetas:read_write", "profile:read"],
      }),
    ).toEqual({ name: "Renamed", scopes: ["recetas:read_write", "profile:read"] });
  });

  it("omits an expiry the user did not change", () => {
    expect(
      buildApiKeyUpdateInput({
        name: "Renamed",
        scopes: ["profile:read"],
        expiresAt: "2027-05-01T10:00",
        currentExpiresAt: "2027-05-01T10:00",
      }),
    ).toEqual({ name: "Renamed", scopes: ["profile:read"] });
  });

  it("converts a changed expiry to the ISO instant the API expects", () => {
    const patch = buildApiKeyUpdateInput({
      name: "Renamed",
      scopes: ["profile:read"],
      expiresAt: "2027-05-01T10:00",
      currentExpiresAt: "",
    });

    expect(patch?.expires_at).toBe(new Date("2027-05-01T10:00").toISOString());
  });

  it("omits the expiry when the field is empty", () => {
    const patch = buildApiKeyUpdateInput({
      name: "Renamed",
      scopes: ["profile:read"],
      expiresAt: "",
      currentExpiresAt: "2027-05-01T10:00",
    });

    expect(patch).not.toHaveProperty("expires_at");
  });

  it("rejects an empty name, no scopes or an unparseable expiry", () => {
    expect(buildApiKeyUpdateInput({ name: "   ", scopes: ["profile:read"] })).toBeNull();
    expect(buildApiKeyUpdateInput({ name: "Renamed", scopes: [] })).toBeNull();
    expect(
      buildApiKeyUpdateInput({
        name: "Renamed",
        scopes: ["profile:read"],
        expiresAt: "not-a-date",
        currentExpiresAt: "",
      }),
    ).toBeNull();
  });
});
