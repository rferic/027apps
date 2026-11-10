import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
}));

import {
  ApiKeyCreateError,
  ApiKeyCreateForm,
  ApiKeyCreatedPanel,
  ApiKeyKindFields,
  ApiKeyOwnerField,
  apiKeyFormReducer,
  buildApiKeyCreateInput,
  INITIAL_API_KEY_FORM_STATE,
} from "./api-key-create-form";
import { allowedApiKeyScopes } from "@/lib/api-key-scopes";
import { ApiKeyScopeFieldset } from "./api-key-scope-fieldset";

const OWNERS = [
  { id: "u1", name: "Sara" },
  { id: "u2", name: "Ana" },
];

function form(
  overrides: Partial<Parameters<typeof ApiKeyCreateForm>[0]> = {},
) {
  return (
    <ApiKeyCreateForm
      canCreateService
      canChooseOwner
      currentUserId="u1"
      owners={OWNERS}
      activeCounts={{}}
      loadModules={async () => ({ ok: true, modules: [] })}
      messages={{}}
      {...overrides}
    />
  );
}

function fields(
  kind: "service" | "delegated",
  roleCap: "admin" | "super_admin" | "" = "admin",
  selected: readonly string[] = [],
) {
  return renderToStaticMarkup(
    <>
      <ApiKeyKindFields
        canCreateService
        kind={kind}
        roleCap={roleCap}
        onKindChange={() => {}}
        onRoleCapChange={() => {}}
        fieldErrors={{}}
        messages={{}}
      />
      <ApiKeyScopeFieldset
        kind={kind}
        roleCap={roleCap}
        selected={selected}
        onToggle={() => {}}
        onSelectAll={() => {}}
        onClearAll={() => {}}
        fieldErrors={{}}
        messages={{}}
      />
    </>,
  );
}

describe("ApiKeyCreateForm", () => {
  it("renders the fields on a page, not inside a creation dialog", () => {
    const html = renderToStaticMarkup(form({ canCreateService: false, canChooseOwner: false }));

    expect(html).toContain("<form");
    // The form is page content, so it needs a surface of its own on wide screens.
    expect(html).toMatch(/<form[^>]*rounded-card[^>]*bg-surface/);
    expect(html).toContain("api-key-name");
    expect(html).toContain("Cancel");
    expect(html).toContain('href="/keys"');
    expect(html).not.toContain("<dialog");
  });

  it("starts empty: no secret from a previous creation", () => {
    const html = renderToStaticMarkup(form());

    expect(html).not.toContain("API key created");
    expect(html).not.toContain("Copy this key now.");
    expect(html).toContain("Create API key");
  });

  it("starts on a key that never expires", () => {
    const html = renderToStaticMarkup(form());

    expect(html).toContain("Expiry");
    expect(html).toContain("Never expires");
    expect(html).toContain('checked="" value="never"');
    expect(html).not.toContain('value="keep"');
    expect(html).toContain("Expires in");
  });

  it("does not offer service keys to an actor who cannot create them", () => {
    const html = renderToStaticMarkup(form({ canCreateService: false, canChooseOwner: false }));

    expect(html).toContain('value="delegated"');
    expect(html).not.toContain('value="service"');
    expect(html).not.toContain("api-key-role-cap");
  });

  it("offers service creation to a super_admin", () => {
    const html = renderToStaticMarkup(form());

    expect(html).toContain('value="service"');
  });

  it("offers the owner selector for a delegated key to a super_admin", () => {
    const html = renderToStaticMarkup(form());

    expect(html).toContain('name="owner_id"');
    expect(html).toContain("Sara");
    expect(html).toContain("Ana");
    expect(html).toContain("The key acts for the selected user.");
  });

  it("hides the owner selector when the actor cannot choose an owner", () => {
    const html = renderToStaticMarkup(form({ canChooseOwner: false }));

    expect(html).not.toContain('name="owner_id"');
  });

  it("explains the limit and disables creation for an owner with 5 active keys", () => {
    const html = renderToStaticMarkup(form({ activeCounts: { u1: 5 } }));

    expect(html).toContain("This user has reached the limit of 5 active keys.");
    expect(html).toContain("disabled");
  });

  it("does not disable creation while the owner has room", () => {
    const html = renderToStaticMarkup(form({ activeCounts: { u1: 4 } }));

    expect(html).not.toContain("This user has reached the limit of 5 active keys.");
  });
});

describe("ApiKeyOwnerField", () => {
  it("keeps the selected owner when it is part of the list", () => {
    const html = renderToStaticMarkup(
      <ApiKeyOwnerField
        owners={OWNERS}
        currentUserId="u1"
        ownerId="u2"
        activeCounts={{}}
        onOwnerChange={() => {}}
        fieldErrors={{}}
        messages={{}}
      />,
    );

    expect(html).toContain('<option value="u2" selected=""');
  });
});

describe("ApiKeyKindFields and scopes", () => {
  it("offers a role cap for a service key", () => {
    const html = fields("service", "super_admin");

    expect(html).toContain('value="service"');
    expect(html).toContain("api-key-role-cap");
    expect(html).toContain('value="super_admin"');
  });

  it("does not offer maintenance:run to a service key capped at admin", () => {
    const html = fields("service", "admin");

    expect(html).not.toContain('value="maintenance:run"');
    expect(html).not.toContain('value="users:deactivate"');
  });

  it("offers maintenance:run and super-admin scopes to a super_admin service key", () => {
    const html = fields("service", "super_admin");

    expect(html).toContain('value="maintenance:run"');
    expect(html).toContain('value="users:deactivate"');
  });

  it("never offers maintenance:run or administration scopes to a delegated key", () => {
    const html = fields("delegated", "super_admin");

    expect(html).not.toContain('value="maintenance:run"');
    expect(html).not.toContain('value="users:deactivate"');
    expect(html).not.toContain('value="settings:write"');
    expect(html).not.toContain('value="currencies:write"');
    expect(html).toContain('value="users:read"');
    expect(html).toContain('value="user_categories:read"');
  });

  it("asks for a role cap before offering the super-admin-only scopes", () => {
    const html = fields("service", "");

    expect(html).toContain("api-key-role-cap");
    expect(html).toContain('value=""');
    expect(html).toContain("Choose a role cap.");
    expect(html).not.toContain('value="maintenance:run"');
    expect(html).not.toContain('value="users:deactivate"');
  });

  it("marks only the selected scopes as checked", () => {
    const html = fields("delegated", "", ["users:read"]);

    expect(html).toContain('checked="" value="users:read"');
    expect(html).not.toContain('checked="" value="users:write"');
  });

  it("offers select-all and clear-all next to the scopes", () => {
    const html = fields("delegated", "", []);

    expect(html).toContain(">Select all</button>");
    expect(html).toContain(">Clear all</button>");
  });

  it("disables select-all when every offered scope is already selected", () => {
    const html = fields("delegated", "", allowedApiKeyScopes("delegated", ""));

    expect(buttonMarkup(html, "Select all")).toContain("disabled");
    expect(buttonMarkup(html, "Clear all")).not.toContain("disabled");
  });

  it("disables clear-all when nothing is selected", () => {
    const html = fields("delegated", "", []);

    expect(buttonMarkup(html, "Clear all")).toContain("disabled");
    expect(buttonMarkup(html, "Select all")).not.toContain("disabled");
  });

  it("disables select-all for a service key without a role cap", () => {
    const html = fields("service", "", []);

    expect(buttonMarkup(html, "Select all")).toContain("disabled");
    expect(buttonMarkup(html, "Clear all")).toContain("disabled");
  });
});

function buttonMarkup(html: string, label: string): string {
  const match = new RegExp(`<button[^>]*>${label}</button>`).exec(html);
  if (!match) throw new Error(`no button "${label}"`);
  // Drop the class attribute: `disabled:` utility classes are not the attribute.
  return match[0].replace(/\sclass="[^"]*"/, "");
}

describe("apiKeyFormReducer", () => {
  const superAdminService = apiKeyFormReducer(
    apiKeyFormReducer(INITIAL_API_KEY_FORM_STATE, { type: "kind", kind: "service" }),
    { type: "role-cap", roleCap: "super_admin" },
  );

  it("starts delegated, owned by the actor, with no role cap, no scopes and no modules", () => {
    expect(INITIAL_API_KEY_FORM_STATE).toEqual({
      kind: "delegated",
      roleCap: "",
      ownerId: "",
      scopes: [],
      modules: [],
    });
  });

  it("requires a role cap again when the kind becomes service", () => {
    const service = apiKeyFormReducer(
      { kind: "delegated", roleCap: "admin", ownerId: "u2", scopes: ["users:read"], modules: [] },
      { type: "kind", kind: "service" },
    );

    expect(service.roleCap).toBe("");
    expect(service.ownerId).toBe("");
    expect(service.scopes).toEqual(["users:read"]);
  });

  it("drops the scopes the new kind no longer allows", () => {
    const delegated = apiKeyFormReducer(superAdminService, { type: "kind", kind: "delegated" });

    expect(delegated.roleCap).toBe("");
    expect(delegated.scopes).toEqual([]);
  });

  it("drops cap-dependent scopes when the cap is lowered", () => {
    const selected = { ...superAdminService, scopes: ["users:read", "maintenance:run"] };
    const admin = apiKeyFormReducer(selected, { type: "role-cap", roleCap: "admin" });

    expect(admin.roleCap).toBe("admin");
    expect(admin.scopes).toEqual(["users:read"]);
  });

  it("does not restore a pruned selection when the cap or kind comes back", () => {
    const pruned = apiKeyFormReducer(superAdminService, { type: "kind", kind: "delegated" });
    const back = apiKeyFormReducer(
      apiKeyFormReducer(pruned, { type: "kind", kind: "service" }),
      { type: "role-cap", roleCap: "super_admin" },
    );

    expect(back.scopes).toEqual([]);
  });

  it("ignores a scope outside the current kind and cap", () => {
    const state = apiKeyFormReducer(INITIAL_API_KEY_FORM_STATE, {
      type: "scope",
      scope: "maintenance:run",
      checked: true,
    });

    expect(state.scopes).toEqual([]);
  });

  it("removes a selected scope when it is unchecked", () => {
    const checked = apiKeyFormReducer(INITIAL_API_KEY_FORM_STATE, {
      type: "scope",
      scope: "users:read",
      checked: true,
    });
    const unchecked = apiKeyFormReducer(checked, {
      type: "scope",
      scope: "users:read",
      checked: false,
    });

    expect(checked.scopes).toEqual(["users:read"]);
    expect(unchecked.scopes).toEqual([]);
  });

  it("select-all selects exactly the scopes offered for the kind and cap", () => {
    const state = apiKeyFormReducer(INITIAL_API_KEY_FORM_STATE, { type: "select-all-scopes" });

    expect(state.scopes).toEqual([...allowedApiKeyScopes("delegated", "")]);
    expect(state.scopes).not.toContain("maintenance:run");
    expect(state.scopes).not.toContain("users:write");
  });

  it("select-all uses the new allowlist after switching kind or cap", () => {
    const service = apiKeyFormReducer(
      apiKeyFormReducer(INITIAL_API_KEY_FORM_STATE, { type: "kind", kind: "service" }),
      { type: "role-cap", roleCap: "super_admin" },
    );
    const serviceAll = apiKeyFormReducer(service, { type: "select-all-scopes" });

    expect(serviceAll.scopes).toEqual([...allowedApiKeyScopes("service", "super_admin")]);
    expect(serviceAll.scopes).toContain("maintenance:run");

    const delegated = apiKeyFormReducer(serviceAll, { type: "kind", kind: "delegated" });
    const delegatedAll = apiKeyFormReducer(delegated, { type: "select-all-scopes" });

    expect(delegatedAll.scopes).toEqual([...allowedApiKeyScopes("delegated", "")]);
    expect(delegatedAll.scopes).not.toContain("maintenance:run");
  });

  it("select-all does nothing while a service key has no role cap", () => {
    const service = apiKeyFormReducer(INITIAL_API_KEY_FORM_STATE, { type: "kind", kind: "service" });

    const state = apiKeyFormReducer(service, { type: "select-all-scopes" });

    expect(state.scopes).toEqual([]);
  });

  it("clear-all removes every selected scope", () => {
    const selected = apiKeyFormReducer(INITIAL_API_KEY_FORM_STATE, {
      type: "scope",
      scope: "users:read",
      checked: true,
    });

    const cleared = apiKeyFormReducer(selected, { type: "clear-scopes" });

    expect(cleared.scopes).toEqual([]);
  });

  it("records the chosen owner", () => {
    const state = apiKeyFormReducer(INITIAL_API_KEY_FORM_STATE, {
      type: "owner",
      ownerId: "u2",
    });

    expect(state.ownerId).toBe("u2");
  });

  it("records the owner's modules so their scopes can be selected", () => {
    const state = apiKeyFormReducer(INITIAL_API_KEY_FORM_STATE, {
      type: "modules",
      modules: [{ key: "recetas", name: "Recetas" }],
    });

    expect(state.modules).toEqual([{ key: "recetas", name: "Recetas" }]);

    const checked = apiKeyFormReducer(state, {
      type: "scope",
      scope: "recetas:read",
      checked: true,
    });
    expect(checked.scopes).toEqual(["recetas:read"]);
  });

  it("drops the previous owner's module scopes when the owner changes", () => {
    const withModules = apiKeyFormReducer(INITIAL_API_KEY_FORM_STATE, {
      type: "modules",
      modules: [{ key: "recetas", name: "Recetas" }],
    });
    const selected = apiKeyFormReducer(withModules, {
      type: "scope",
      scope: "recetas:read",
      checked: true,
    });
    const core = apiKeyFormReducer(selected, {
      type: "scope",
      scope: "profile:read",
      checked: true,
    });

    const changed = apiKeyFormReducer(core, { type: "owner", ownerId: "u2" });
    expect(changed.ownerId).toBe("u2");
    expect(changed.modules).toEqual([]);
    expect(changed.scopes).toEqual(["profile:read"]);

    // The new owner's modules never resurrect the previous selection.
    const next = apiKeyFormReducer(changed, {
      type: "modules",
      modules: [{ key: "fotos", name: "Fotos" }],
    });
    expect(next.scopes).toEqual(["profile:read"]);
  });

  it("drops module scopes when the kind becomes service", () => {
    const withModules = apiKeyFormReducer(INITIAL_API_KEY_FORM_STATE, {
      type: "modules",
      modules: [{ key: "recetas", name: "Recetas" }],
    });
    const selected = apiKeyFormReducer(withModules, {
      type: "scope",
      scope: "recetas:read",
      checked: true,
    });

    const service = apiKeyFormReducer(selected, { type: "kind", kind: "service" });

    expect(service.modules).toEqual([]);
    expect(service.scopes).toEqual([]);
  });

  it("select-all includes the module scopes of the owner", () => {
    const withModules = apiKeyFormReducer(INITIAL_API_KEY_FORM_STATE, {
      type: "modules",
      modules: [{ key: "recetas", name: "Recetas" }],
    });

    const all = apiKeyFormReducer(withModules, { type: "select-all-scopes" });

    expect(all.scopes).toContain("recetas:read");
    expect(all.scopes).toContain("recetas:read_write");
    expect(all.scopes).toContain("profile:read");
  });

  it("selecting read-and-write also selects read", () => {
    const withModules = apiKeyFormReducer(INITIAL_API_KEY_FORM_STATE, {
      type: "modules",
      modules: [{ key: "recetas", name: "Recetas" }],
    });

    const state = apiKeyFormReducer(withModules, {
      type: "scope",
      scope: "recetas:read_write",
      checked: true,
    });

    expect(state.scopes).toEqual(["recetas:read", "recetas:read_write"]);

    const withoutRead = apiKeyFormReducer(state, {
      type: "scope",
      scope: "recetas:read",
      checked: false,
    });
    expect(withoutRead.scopes).toEqual([]);
  });
});

describe("buildApiKeyCreateInput", () => {
  it("sends user_id only when a super_admin picks another owner", () => {
    expect(
      buildApiKeyCreateInput({ kind: "delegated", name: "Key", scopes: ["profile:read"], ownerId: "u2" }, "u1"),
    ).toEqual({ kind: "delegated", name: "Key", scopes: ["profile:read"], user_id: "u2" });
  });

  it("keeps the actor as owner when no other user is selected", () => {
    expect(
      buildApiKeyCreateInput({ kind: "delegated", name: "Key", scopes: ["profile:read"], ownerId: "" }, "u1"),
    ).toEqual({ kind: "delegated", name: "Key", scopes: ["profile:read"] });
  });

  it("never sends an owner for a service key", () => {
    expect(
      buildApiKeyCreateInput(
        { kind: "service", name: "Service", scopes: ["users:read"], roleCap: "admin", ownerId: "u2" },
        "u1",
      ),
    ).toEqual({ kind: "service", name: "Service", scopes: ["users:read"], role_cap: "admin" });
  });

  it("sends the module scopes of the owner's modules and drops the rest", () => {
    expect(
      buildApiKeyCreateInput(
        {
          kind: "delegated",
          name: "Key",
          scopes: ["profile:read", "recetas:read", "fotos:read"],
          modules: [{ key: "recetas", name: "Recetas" }],
        },
        "u1",
      ),
    ).toEqual({
      kind: "delegated",
      name: "Key",
      scopes: ["profile:read", "recetas:read"],
    });
  });

  it("does not send an expiry for a key that never expires or keeps it", () => {
    const base = { kind: "delegated" as const, name: "Key", scopes: ["profile:read"] };

    expect(buildApiKeyCreateInput({ ...base, expiry: { mode: "never" } }, "u1")).toEqual({
      kind: "delegated",
      name: "Key",
      scopes: ["profile:read"],
    });
    expect(buildApiKeyCreateInput({ ...base, expiry: { mode: "keep" } }, "u1")).toEqual({
      kind: "delegated",
      name: "Key",
      scopes: ["profile:read"],
    });
  });

  it("sends the instant of a relative expiry", () => {
    const before = Date.now();
    const input = buildApiKeyCreateInput(
      {
        kind: "delegated",
        name: "Key",
        scopes: ["profile:read"],
        expiry: { mode: "relative", amount: 30, unit: "days" },
      },
      "u1",
    );

    const offset = new Date(input.expires_at ?? "").getTime() - before;
    expect(offset).toBeGreaterThanOrEqual(30 * 86_400_000);
    expect(offset).toBeLessThan(30 * 86_400_000 + 5_000);
  });

  it("refuses an invalid relative amount instead of sending it", () => {
    expect(() =>
      buildApiKeyCreateInput(
        {
          kind: "delegated",
          name: "Key",
          scopes: ["profile:read"],
          expiry: { mode: "relative", amount: 0, unit: "days" },
        },
        "u1",
      ),
    ).toThrow(RangeError);
  });
});

describe("ApiKeyCreateError", () => {
  it("explains the five-key limit instead of a generic conflict", () => {
    const html = renderToStaticMarkup(
      <ApiKeyCreateError
        error={{ ok: false, code: "conflict", details: { code: "key_limit" } }}
        messages={{}}
      />,
    );

    expect(html).toContain("This user has reached the limit of 5 active keys.");
    expect(html).not.toContain("We couldn't create the API key.");
  });

  it("falls back to the generic failure for any other error", () => {
    const html = renderToStaticMarkup(
      <ApiKeyCreateError error={{ ok: false, code: "internal" }} messages={{}} />,
    );

    expect(html).toContain("We couldn&#x27;t create the API key.");
  });
});

describe("ApiKeyCreatedPanel", () => {
  it("asks for a manual copy when the clipboard copy failed (insecure context)", () => {
    const html = renderToStaticMarkup(
      <ApiKeyCreatedPanel
        secret="027_svc_abc"
        copied={false}
        copyFailed
        onCopy={() => {}}
        messages={{}}
      />,
    );

    expect(html).toContain("Select the text and copy it manually.");
    expect(html).toContain("027_svc_abc");
  });

  it("shows the one-time secret on the page with copy and a Done link to the list", () => {
    const html = renderToStaticMarkup(
      <ApiKeyCreatedPanel secret="027_svc_abc" copied={false} onCopy={() => {}} messages={{}} />,
    );

    expect(html).toContain("027_svc_abc");
    expect(html).toContain("Copy this key now. It will not be shown again.");
    expect(html).toContain("Done");
    expect(html).toContain('href="/keys"');
    expect(html).not.toContain("<form");
    expect(html).not.toContain("Create API key<");
    expect(html).not.toContain("api-key-name");
  });

  it("does not leave a second creation path when the API returned no secret", () => {
    const html = renderToStaticMarkup(
      <ApiKeyCreatedPanel secret={null} copied={false} onCopy={() => {}} messages={{}} />,
    );

    expect(html).toContain("The key was created but the API did not return the secret.");
    expect(html).toContain("Done");
    expect(html).not.toContain("<form");
  });
});
