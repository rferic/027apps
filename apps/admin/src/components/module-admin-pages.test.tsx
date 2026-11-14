import { readFile } from "node:fs/promises";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import OweNoGroups from "@027apps/owe-no/admin/groups/page";
import OweNoImports from "@027apps/owe-no/admin/imports/page";
import OweNoOverview from "@027apps/owe-no/admin/overview/page";
import type { ModulePageContext } from "@027apps/core/modules/pages.js";

const MESSAGES = new URL("../../../../packages/owe-no/locales/es.json", import.meta.url);

/** A module page only reads through the injected connection; no rows, no noise. */
function context(messages: Record<string, string>): ModulePageContext {
  return {
    moduleKey: "owe-no",
    caller: { kind: "session", userId: "u1", role: "admin" },
    db: { query: async () => ({ rows: [] }) },
    locale: "es",
    messages,
  };
}

async function spanish() {
  return JSON.parse(await readFile(MESSAGES, "utf8")) as Record<string, string>;
}

describe("owe-no admin pages", () => {
  it("renders the overview in the panel locale, never a hardcoded English string", async () => {
    const html = renderToStaticMarkup(
      await OweNoOverview({ context: context(await spanish()) }),
    );
    expect(html).toContain("Grupos activos");
    expect(html).toContain("Aún no hay grupos. El primero se crea desde la app.");
    expect(html).not.toContain("Active groups");
    expect(html).not.toContain("No groups yet");
  });

  it("renders the group list in the panel locale", async () => {
    const html = renderToStaticMarkup(await OweNoGroups({ context: context(await spanish()) }));
    expect(html).toContain(">Grupos<");
    expect(html).toContain("Aún no hay grupos.");
    expect(html).not.toContain(">Groups<");
  });

  it("renders the import history in the panel locale", async () => {
    const html = renderToStaticMarkup(await OweNoImports({ context: context(await spanish()) }));
    expect(html).toContain("Importaciones");
    expect(html).toContain("Aún no hay importaciones.");
    expect(html).not.toContain("No imports yet");
  });
});
