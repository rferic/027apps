import { readFile } from "node:fs/promises";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import OweNoGroups from "@027apps/owe-no/admin/groups/page";
import OweNoImports from "@027apps/owe-no/admin/imports/page";
import OweNoOverview from "@027apps/owe-no/admin/overview/page";
import type { ModulePageContext } from "@027apps/core/modules/pages.js";

const MESSAGES = new URL("../../../../packages/owe-no/locales/es.json", import.meta.url);

/** A module page only reads through the injected connection; no rows, no noise. */
function context(
  messages: Record<string, string>,
  searchParams: Record<string, string | string[] | undefined> = {},
): ModulePageContext {
  return {
    moduleKey: "owe-no",
    caller: { kind: "session", userId: "u1", role: "admin" },
    db: { query: async () => ({ rows: [] }) },
    locale: "es",
    messages,
    searchParams,
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
          transfer: noop,
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
      categories: [{ id: "c1", name: "Alimentos" }],
      members: [
        { id: "m1", display_name: "Ana", state: "active" as const, user_id: "u1", balance: 500 },
        { id: "m2", display_name: "Luis", state: "active" as const, user_id: null, balance: -500 },
        { id: "m3", display_name: "Marta", state: "removed" as const, user_id: null, balance: 0 },
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
          created_by_name: "Admin",
          updated_by_name: null,
          created_at: "2026-11-14T10:00:00.000Z",
          updated_at: "2026-11-14T10:00:00.000Z",
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
          transfer: noop,
        },
      }),
    );

    expect(html).toContain("Casa");
    expect(html).toContain("Editar");
    expect(html).toContain("Archivar grupo");
    // The forms live on their own pages; the group only links to them.
    expect(html).toContain("Añadir gasto");
    expect(html).toContain("Liquidar");
    expect(html).toContain("Añadir miembro");
    expect(html).toContain("?group=11111111-1111-4111-8111-111111111111&amp;view=movement");
    expect(html).toContain("Luis");
    expect(html).not.toContain("Add expense");
    // Destructive actions ask first, and every state is translated.
    expect(html).toContain("¿Archivar el grupo?");
    expect(html).toContain("¿Quitar al miembro?");
    expect(html).toContain("Quitado");
    expect(html).not.toContain(">removed<");
    // Mobile: the actions own a full row instead of wrapping around the title.
    expect(html).toContain("grid grid-cols-2 gap-2 sm:flex");
  });

  it("gives every form its own page", async () => {
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
        movements: 0,
      },
      categories: [],
      members: [
        { id: "m1", display_name: "Ana", state: "active" as const, user_id: "u1", balance: 0 },
        { id: "m2", display_name: "Luis", state: "active" as const, user_id: null, balance: 0 },
      ],
      movements: [],
    };
    const actions = {
      createGroup: noop,
      archiveGroup: noop,
      addMember: noop,
      linkMember: noop,
      removeMember: noop,
      saveMovement: noop,
      deleteMovement: noop,
      settle: noop,
      transfer: noop,
    };
    const messages = await spanish();
    const group = "11111111-1111-4111-8111-111111111111";

    const movement = renderToStaticMarkup(
      await OweNoGroups({
        context: context(messages, { group, view: "movement" }),
        groups: [],
        detail,
        userOptions: [],
        plan: null,
        actions,
      }),
    );
    expect(movement).toContain("Participantes");
    expect(movement).toContain("Guardar gasto");

    const settle = renderToStaticMarkup(
      await OweNoGroups({
        context: context(messages, { group, view: "settle" }),
        groups: [],
        detail,
        userOptions: [],
        plan: { exact: true, transfers: [{ from: "m1", to: "m2", amount_minor: 500 }] },
        actions,
      }),
    );
    expect(settle).toContain("Registrar pago");
    expect(settle).toContain("Luis");

    const member = renderToStaticMarkup(
      await OweNoGroups({
        context: context(messages, { group, view: "member" }),
        groups: [],
        detail,
        userOptions: [],
        plan: null,
        actions,
      }),
    );
    expect(member).toContain("Cuenta (opcional)");
    expect(member).toContain("Añadir miembro");
  });
});

