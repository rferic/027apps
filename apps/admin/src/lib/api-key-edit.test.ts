import { describe, expect, it } from "vitest";
import { allowedApiKeyScopes } from "@/lib/api-key-scopes";
import {
  apiKeyFingerprint,
  buildApiKeyUpdateInput,
  mergeKeyScopes,
  selectAllKeyScopes,
  splitKeyScopes,
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

describe("apiKeyFingerprint", () => {
  const KEY = {
    id: "k1",
    name: "Zapier",
    expiresAt: null,
    scopes: ["users:read", "profile:read"],
  };

  it("is stable, whatever the stored scope order is", () => {
    expect(apiKeyFingerprint(KEY)).toBe(
      apiKeyFingerprint({ ...KEY, scopes: ["profile:read", "users:read"] }),
    );
    expect(apiKeyFingerprint(KEY)).toBe(apiKeyFingerprint(KEY));
  });

  it("does not reorder or mutate the scopes it was given", () => {
    const scopes = ["users:read", "profile:read"];

    apiKeyFingerprint({ ...KEY, scopes });

    expect(scopes).toEqual(["users:read", "profile:read"]);
  });

  it("changes when a scope, the name, the expiry or the key changes", () => {
    const base = apiKeyFingerprint(KEY);

    expect(apiKeyFingerprint({ ...KEY, scopes: ["users:read"] })).not.toBe(base);
    expect(apiKeyFingerprint({ ...KEY, scopes: [...KEY.scopes, "modules:read"] })).not.toBe(base);
    expect(apiKeyFingerprint({ ...KEY, name: "Zapier 2" })).not.toBe(base);
    expect(apiKeyFingerprint({ ...KEY, expiresAt: "2027-05-01T10:00:00.000Z" })).not.toBe(base);
    expect(apiKeyFingerprint({ ...KEY, id: "k2" })).not.toBe(base);
  });

  it("never lets two different fields collide when one contains the separator", () => {
    expect(apiKeyFingerprint({ ...KEY, name: "a:b", scopes: ["c"] })).not.toBe(
      apiKeyFingerprint({ ...KEY, name: "a", scopes: ["b:c"] }),
    );
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

  it("rejects an empty name or no scopes", () => {
    expect(buildApiKeyUpdateInput({ name: "   ", scopes: ["profile:read"] })).toBeNull();
    expect(buildApiKeyUpdateInput({ name: "Renamed", scopes: [] })).toBeNull();
  });
});
