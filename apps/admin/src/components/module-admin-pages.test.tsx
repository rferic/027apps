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
    searchParams: {},
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
    const noop = async () => {};
    const html = renderToStaticMarkup(
      await OweNoGroups({
        context: context(await spanish()),
        groups: [],
        detail: null,
        userOptions: [],
        plan: null,
        actions: {
          createGroup: noop,
          archiveGroup: noop,
          addMember: noop,
          linkMember: noop,
          removeMember: noop,
          saveMovement: noop,
          deleteMovement: noop,
          settle: noop,
        },
      }),
    );
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

  it("renders one group with its balances, movements and settlement", async () => {
    const noop = async () => {};
    const detail = {
      group: {
        id: "11111111-1111-4111-8111-111111111111",
        name: "Casa",
        currency: "EUR",
        archived: false,
        created_by: null,
        archived_by: null,
        members: 2,
        movements: 1,
      },
      members: [
        { id: "m1", display_name: "Ana", state: "active" as const, user_id: "u1", balance: 500 },
        { id: "m2", display_name: "Luis", state: "active" as const, user_id: null, balance: -500 },
      ],
      movements: [
        {
          id: "mv1",
          kind: "expense" as const,
          description: "Cena",
          amount_minor: 1000,
          currency: "EUR",
          paid_by: "m1",
          occurred_on: "2026-11-14",
          category_id: null,
          shares: [
            { memberId: "m1", amount_minor: 500 },
            { memberId: "m2", amount_minor: 500 },
          ],
        },
      ],
    };

    const html = renderToStaticMarkup(
      await OweNoGroups({
        context: context(await spanish()),
        groups: [],
        detail,
        userOptions: [{ id: "u1", display_name: "Ana" }],
        plan: { exact: true, transfers: [{ from: "m2", to: "m1", amount_minor: 500 }] },
        actions: {
          createGroup: noop,
          archiveGroup: noop,
          addMember: noop,
          linkMember: noop,
          removeMember: noop,
          saveMovement: noop,
          deleteMovement: noop,
          settle: noop,
        },
      }),
    );

    expect(html).toContain("Casa");
    expect(html).toContain("Editar");
    expect(html).toContain("Archivar grupo");
    expect(html).toContain("Registrar pago");
    expect(html).toContain("Luis");
    expect(html).not.toContain("Add expense");
  });
});

