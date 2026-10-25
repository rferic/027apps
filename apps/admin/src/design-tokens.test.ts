import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Garantiza que tokens.json (espejo exportable, futuro consumidor: Android)
// y design-tokens.css (fuente de verdad en el admin) no divergen.
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
const darkVars = varsOf(
  css.match(/prefers-color-scheme:\s*dark\s*\)\s*\{\s*:root\s*\{([^}]*)\}/)?.[1] ?? "",
);

const colorRoles = Object.keys(mirror.light);
const nonColorRoles = ["card-radius", "control-radius"];

describe("tokens.json refleja design-tokens.css", () => {
  it("define el bloque dark", () => {
    expect(darkVars).not.toEqual({});
  });

  it.each(["light", "dark"] as const)("coincide en todas las parejas en %s", (theme) => {
    const vars = theme === "light" ? lightVars : darkVars;
    for (const role of colorRoles) {
      expect(vars[role], `rol ${role} en ${theme}`).toBe(normalize(mirror[theme][role]));
    }
  });

  it("no define ni falta roles de color frente al espejo", () => {
    const extra = Object.keys(lightVars).filter(
      (key) => !colorRoles.includes(key) && !nonColorRoles.includes(key),
    );
    expect(extra).toEqual([]);
    for (const role of colorRoles) {
      expect(lightVars, `falta el rol ${role}`).toHaveProperty(role);
    }
  });

  it("coincide en los radios", () => {
    expect(lightVars["card-radius"]).toBe(normalize(mirror.radii.card));
    expect(lightVars["control-radius"]).toBe(normalize(mirror.radii.control));
  });
});

describe("globals.css mapea todos los roles a utilidades Tailwind", () => {
  const globals = readFileSync(
    join(fileURLToPath(new URL(".", import.meta.url)), "../src/app/globals.css"),
    "utf8",
  );

  const mappedVars = globals.match(/@theme\s*inline\s*\{([^}]*)\}/)?.[1] ?? "";
  const mapped = new Set(
    [...mappedVars.matchAll(/--color-([\w-]+)\s*:/g)].map(([, name]) => name),
  );

  it("mapea cada rol de color del espejo a una utilidad --color-*", () => {
    for (const role of colorRoles) {
      expect(mapped, `falta mapear rol ${role} en @theme`).toContain(role);
    }
  });

  it("no mapea roles que el espejo no define (evita derivas por copia)", () => {
    for (const name of mapped) {
      expect(colorRoles, `rol extra mapeado: ${name}`).toContain(name);
    }
  });
});
