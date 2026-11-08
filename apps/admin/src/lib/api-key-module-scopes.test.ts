import { describe, expect, it } from "vitest";
import {
  apiKeyOfferedScopes,
  moduleScopes,
  withModuleImplication,
} from "./api-key-module-scopes";

const MODULES = [
  { key: "recetas", name: "Recetas" },
  { key: "fotos", name: "Fotos" },
];

describe("moduleScopes", () => {
  it("offers read and read-and-write for every module, read first", () => {
    expect(moduleScopes(MODULES)).toEqual([
      "recetas:read",
      "recetas:read_write",
      "fotos:read",
      "fotos:read_write",
    ]);
  });

  it("offers nothing when the owner has no modules", () => {
    expect(moduleScopes([])).toEqual([]);
  });
});

describe("apiKeyOfferedScopes", () => {
  it("adds the module scopes to the delegated allowlist", () => {
    const offered = apiKeyOfferedScopes("delegated", "", MODULES);

    expect(offered).toContain("profile:read");
    expect(offered).toContain("recetas:read");
    expect(offered).toContain("recetas:read_write");
    expect(offered).not.toContain("maintenance:run");
  });

  it("never offers module scopes for a service key", () => {
    const offered = apiKeyOfferedScopes("service", "admin", MODULES);

    expect(offered).not.toContain("recetas:read");
    expect(offered).not.toContain("recetas:read_write");
  });
});

describe("withModuleImplication", () => {
  it("selects read when read-and-write is selected", () => {
    expect(withModuleImplication([], "recetas:read_write", true)).toEqual([
      "recetas:read",
      "recetas:read_write",
    ]);
  });

  it("drops read-and-write when read is deselected", () => {
    expect(
      withModuleImplication(["recetas:read", "recetas:read_write"], "recetas:read", false),
    ).toEqual([]);
  });

  it("keeps read when read-and-write is deselected", () => {
    expect(
      withModuleImplication(["recetas:read", "recetas:read_write"], "recetas:read_write", false),
    ).toEqual(["recetas:read"]);
  });

  it("never duplicates a scope that is already selected", () => {
    const selected = ["recetas:read", "recetas:read_write"];

    expect(withModuleImplication(selected, "recetas:read_write", true)).toBe(selected);
    expect(withModuleImplication(selected, "recetas:read", true)).toBe(selected);
  });

  it("leaves the Core scopes untouched", () => {
    expect(withModuleImplication(["profile:read"], "profile:write", true)).toEqual([
      "profile:read",
      "profile:write",
    ]);
  });
});
