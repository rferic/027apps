import { readFile } from "node:fs/promises";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import OweNoGroups from "@027apps/owe-no/admin/groups/page";
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
          deleteGroup: noop,
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

  it("renders the month summary with categories and people", async () => {
    const page = context(await spanish());
    page.db = {
      query: async (sql: string) => {
        if (sql.includes("to_char(mv.occurred_on")) {
          return { rows: [
            { currency: "EUR", month: "2026-10", total: "1000" },
            { currency: "EUR", month: "2026-11", total: "2000" },
          ] };
        }
        if (sql.includes("coalesce(c.name")) {
          return { rows: [{ currency: "EUR", name: "Comida", total: "2000" }] };
        }
        if (sql.includes("with paid as")) {
          return { rows: [{ currency: "EUR", display_name: "Ana", paid: "2000", consumed: "1000" }] };
        }
        return { rows: [] };
      },
    };
    const html = renderToStaticMarkup(await OweNoOverview({ context: page }));
    expect(html).toContain("Este mes");
    expect(html).toContain("Por categoría");
    expect(html).toContain("Comida");
    expect(html).toContain("Ana");
    expect(html).toContain("Personas");
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
          created_by: null,
          created_at: "2026-11-14T10:00:00.000Z",
          updated_at: "2026-11-14T10:00:00.000Z",
          shares: [
            { memberId: "m1", amount_minor: 500 },
            { memberId: "m2", amount_minor: 500 },
          ],
        },
      ],
      expenses_total: 1000,
      category_totals: [{ name: "Comida", total: 1000 }],
      month_total: 1000,
      previous_month_total: 800,
      people_totals: [{ name: "Ana", paid: 1000, consumed: 500 }],
      months: [
        { month: "2026-10", total: 800, categories: [{ name: "Comida", total: 800 }] },
        { month: "2026-11", total: 1000, categories: [{ name: "Comida", total: 1000 }] },
      ],
      first_movement_on: "2026-10-01",
      payments_total: 0,
      movements_total: 1,
      movements_page: 1,
      movements_per_page: 25,
    };

    const html = renderToStaticMarkup(
      await OweNoGroups({
        context: context(await spanish(), {
          group: "11111111-1111-4111-8111-111111111111",
          tab: "movements",
        }),
        groups: [],
        detail,
        userOptions: [{ id: "u1", display_name: "Ana" }],
        plan: { exact: true, transfers: [{ from: "m2", to: "m1", amount_minor: 500 }] },
        actions: {
          createGroup: noop,
          archiveGroup: noop,
          deleteGroup: noop,
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
    // Members, balances and the summary now live in their own tabs.
    expect(html).toContain("tab=members");
    expect(html).toContain("?group=11111111-1111-4111-8111-111111111111&amp;view=movement");
    expect(html).toContain("Movimientos");
    expect(html).not.toContain("Add expense");
    // Destructive actions ask first, and every state is translated.
    expect(html).toContain("¿Archivar el grupo?");
    expect(html).toContain("¿Borrar el movimiento?");
    // The member states are translated wherever the member list is rendered.
    expect(html).not.toContain(">removed<");
    // Dangerous actions live at the bottom, collapsed, not next to "Add expense".
    expect(html).toContain("<details");
    expect(html).toContain("Zona peligrosa");
    expect(html).not.toContain("grid grid-cols-2 gap-2 sm:flex");
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
      expenses_total: 1000,
      category_totals: [{ name: "Comida", total: 1000 }],
      month_total: 1000,
      previous_month_total: 800,
      people_totals: [{ name: "Ana", paid: 1000, consumed: 500 }],
      months: [
        { month: "2026-10", total: 800, categories: [{ name: "Comida", total: 800 }] },
        { month: "2026-11", total: 1000, categories: [{ name: "Comida", total: 1000 }] },
      ],
      first_movement_on: "2026-10-01",
      payments_total: 0,
      movements_total: 1,
      movements_page: 1,
      movements_per_page: 25,
    };
    const actions = {
      createGroup: noop,
      archiveGroup: noop,
      deleteGroup: noop,
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
        userOptions: [
          { id: "u1", display_name: "Ana" },
          { id: "u9", display_name: "Pablo" },
        ],
        plan: null,
        actions,
      }),
    );
    expect(member).toContain("Cuenta (opcional)");
    expect(member).toContain("Añadir miembro");
    // A native select, with every account: the one already in the group is
    // visible but disabled, so nobody wonders why their user is missing.
    expect(member).toContain('<select name="user_id"');
    expect(member).toContain("Pablo");
    expect(member).toContain("Ana");
    expect(member).toContain("Ya en el grupo");
    expect(member).toMatch(/<option[^>]*disabled[^>]*>Ana/);
  });
});


describe("owe-no group page translations", () => {
  it("renders every tab in Spanish, without leaking English keys", async () => {
    const noop = async () => {};
    const messages = await spanish();
    const group = "11111111-1111-4111-8111-111111111111";
    const detail = {
      group: {
        id: group,
        name: "Casa",
        currency: "EUR",
        archived: false,
        created_by: null,
        archived_by: null,
        members: 2,
        movements: 1,
      },
      categories: [{ id: "c1", name: "Comida" }],
      members: [
        { id: "m1", display_name: "Ana", state: "active" as const, user_id: "u1", balance: 500 },
        { id: "m2", display_name: "Luis", state: "active" as const, user_id: null, balance: -500 },
      ],
      movements: [],
      expenses_total: 1000,
      payments_total: 0,
      category_totals: [{ name: "Comida", total: 1000 }],
      month_total: 1000,
      previous_month_total: 800,
      people_totals: [{ name: "Ana", paid: 1000, consumed: 500 }],
      months: [
        { month: "2026-10", total: 800, categories: [{ name: "Comida", total: 800 }] },
        { month: "2026-11", total: 1000, categories: [{ name: "Comida", total: 1000 }] },
      ],
      first_movement_on: "2026-10-01",
      movements_total: 0,
      movements_page: 1,
      movements_per_page: 25,
    };
    const actions = {
      createGroup: noop,
      archiveGroup: noop,
      deleteGroup: noop,
      addMember: noop,
      linkMember: noop,
      removeMember: noop,
      saveMovement: noop,
      deleteMovement: noop,
      settle: noop,
      transfer: noop,
    };
    const render = async (searchParams: Record<string, string>) =>
      renderToStaticMarkup(
        await OweNoGroups({
          context: context(messages, searchParams),
          groups: [],
          detail,
          userOptions: [],
          plan: null,
          actions,
        }),
      );

    // Entering a group lands on its summary, like the app's first tab.
    const landing = await render({ group });
    expect(landing).toContain("Resumen");
    expect(landing).toContain("Este mes");
    expect(landing).not.toContain("Mostrando 0 de 0 movimientos.");
    // Summary is the first tab, not just the default.
    const navStart = landing.indexOf('aria-label="Secciones del grupo"');
    const nav = landing.slice(navStart, landing.indexOf("</nav>", navStart));
    expect(nav.indexOf("tab=summary")).toBeLessThan(nav.indexOf("tab=movements"));
    expect(nav.indexOf("Resumen")).toBeLessThan(nav.indexOf("Movimientos"));

    const movements = await render({ group, tab: "movements" });
    expect(movements).toContain("Movimientos");
    expect(movements).toContain("Tipo");
    expect(movements).toContain("Filtrar");
    expect(movements).toContain("Mostrando 0 de 0 movimientos.");
    expect(movements).not.toContain("Showing {shown}");
    expect(movements).not.toContain("Delete this group for good.");
    expect(movements).toContain("Borrar el grupo no se puede deshacer.");
    expect(movements).toContain("Zona peligrosa");

    // Actions keep the tab: every form on the page posts it back.
    expect(movements).toContain('name="tab"');

    const members = await render({ group, tab: "members" });
    expect(members).toContain("Miembros");
    expect(members).toContain('value="members"');

    const summary = await render({ group, tab: "summary" });
    expect(summary).toContain("Resumen");
    expect(summary).toContain("Este mes");
    expect(summary).toContain("vs. mes anterior");
    expect(summary).toContain("Por categoría");
    expect(summary).toContain("Personas");
    expect(summary).toContain("Evolución");
    expect(summary).toContain("Histórico del grupo");
    expect(summary).toContain("Pagó");
    expect(summary).toContain("Consumió");
    expect(summary).toContain("Solo aparecen las categorías con gasto este mes.");
    expect(summary).toContain("100%");
  });

  it("keeps the import inside the group, with no group picker", async () => {
    const noop = async () => {};
    const messages = await spanish();
    const group = "11111111-1111-4111-8111-111111111111";
    const detail = {
      group: {
        id: group,
        name: "Casa",
        currency: "EUR",
        archived: false,
        created_by: "u1",
        archived_by: null,
        members: 1,
        movements: 622,
      },
      categories: [],
      members: [
        { id: "m1", display_name: "Ana", state: "active" as const, user_id: "u1", balance: 0 },
      ],
      movements: [],
      expenses_total: 4516772,
      payments_total: 217679,
      category_totals: [],
      month_total: 0,
      previous_month_total: 0,
      people_totals: [],
      months: [],
      first_movement_on: null,
      movements_total: 0,
      movements_page: 1,
      movements_per_page: 25,
    };
    const actions = {
      createGroup: noop,
      archiveGroup: noop,
      deleteGroup: noop,
      addMember: noop,
      linkMember: noop,
      removeMember: noop,
      saveMovement: noop,
      deleteMovement: noop,
      settle: noop,
      transfer: noop,
    };
    function Wizard({ groupId }: { groupId: string; locale: string }) {
      return <p>asistente para {groupId}</p>;
    }

    const html = renderToStaticMarkup(
      await OweNoGroups({
        context: context(messages, { group, tab: "imports" }),
        groups: [],
        detail,
        userOptions: [],
        plan: null,
        actions,
        ImportWizard: Wizard,
        imports: [
          {
            id: "b1",
            group_id: group,
            group_name: "Casa",
            imported_by: "u1",
            row_count: 622,
            created_count: 621,
            created_at: "2026-11-15T10:00:00.000Z",
          },
        ],
      }),
    );

    expect(html).toContain("Importar de Splitwise");
    expect(html).toContain(`asistente para ${group}`);
    expect(html).toContain("Importaciones anteriores");
    expect(html).toContain("621 de 622 filas");
    // The group is already chosen: no picker and no other group links.
    expect(html).not.toContain("necesitas crear un grupo");
    expect(html).not.toContain("panel/owe-no/imports?group=");
  });
});
