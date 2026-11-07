import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Ensures tokens.json (exportable mirror, future consumer: Android)
// and design-tokens.css (source of truth in admin) do not diverge.
const css = readFileSync(
  join(fileURLToPath(new URL(".", import.meta.url)), "design-tokens.css"),
  "utf8",
);
const mirror = JSON.parse(
  readFileSync(
    join(fileURLToPath(new URL(".", import.meta.url)), "../tokens.json"),
    "utf8",
  ),
);

const normalize = (value: string) => value.replace(/\s+/g, "").trim().toLowerCase();

const varsOf = (block: string) =>
  Object.fromEntries(
    [...block.matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)].map(([, name, value]) => [
      name,
      normalize(value),
    ]),
  );

const lightVars = varsOf(css.match(/:root\s*\{([^}]*)\}/)?.[1] ?? "");
const systemDarkVars = varsOf(
  css.match(/prefers-color-scheme:\s*dark\s*\)\s*\{\s*:root:not\(\.light\)\s*\{([^}]*)\}/)?.[1] ?? "",
);
const darkVars = varsOf(css.match(/\.dark\s*\{([^}]*)\}/)?.[1] ?? "");

const colorRoles = Object.keys(mirror.light);
const nonColorRoles = ["card-radius", "control-radius"];

describe("tokens.json mirrors design-tokens.css", () => {
  it("defines the dark block", () => {
    expect(darkVars).not.toEqual({});
  });

  it("keeps the system and explicit dark blocks identical", () => {
    expect(systemDarkVars).toEqual(darkVars);
  });

  it.each(["light", "dark"] as const)("matches every pair in %s", (theme) => {
    const vars = theme === "light" ? lightVars : darkVars;
    for (const role of colorRoles) {
      expect(vars[role], `role ${role} in ${theme}`).toBe(normalize(mirror[theme][role]));
    }
  });

  it("defines no extra color roles and misses none versus the mirror", () => {
    const extra = Object.keys(lightVars).filter(
      (key) => !colorRoles.includes(key) && !nonColorRoles.includes(key),
    );
    expect(extra).toEqual([]);
    for (const role of colorRoles) {
      expect(lightVars, `missing role ${role}`).toHaveProperty(role);
    }
  });

  it("matches the radii", () => {
    expect(lightVars["card-radius"]).toBe(normalize(mirror.radii.card));
    expect(lightVars["control-radius"]).toBe(normalize(mirror.radii.control));
  });
});

describe("globals.css maps every role to Tailwind utilities", () => {
  const globals = readFileSync(
    join(fileURLToPath(new URL(".", import.meta.url)), "../src/app/globals.css"),
    "utf8",
  );

  const mappedVars = globals.match(/@theme\s*inline\s*\{([^}]*)\}/)?.[1] ?? "";
  const mapped = new Set(
    [...mappedVars.matchAll(/--color-([\w-]+)\s*:/g)].map(([, name]) => name),
  );

  it("maps every color role from the mirror to a --color-* utility", () => {
    for (const role of colorRoles) {
      expect(mapped, `missing mapping for role ${role} in @theme`).toContain(role);
    }
  });

  it("does not map roles the mirror does not define (avoids copy drift)", () => {
    for (const name of mapped) {
      expect(colorRoles, `extra mapped role: ${name}`).toContain(name);
    }
  });
});
