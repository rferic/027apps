import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
}));

import {
  ApiKeyCreateForm,
  ApiKeyCreatedPanel,
  ApiKeyKindFields,
  ApiKeyScopeChoices,
  apiKeyFormReducer,
  INITIAL_API_KEY_FORM_STATE,
} from "./api-key-create-form";

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
      <ApiKeyScopeChoices
        kind={kind}
        roleCap={roleCap}
        selected={selected}
        onToggle={() => {}}
        fieldErrors={{}}
        messages={{}}
      />
    </>,
  );
}

describe("ApiKeyCreateForm", () => {
  it("renders the fields on a page, not inside a creation dialog", () => {
    const html = renderToStaticMarkup(<ApiKeyCreateForm canCreateService={false} messages={{}} />);

    expect(html).toContain("<form");
    expect(html).toContain("api-key-name");
    expect(html).toContain("Cancel");
    expect(html).toContain('href="/keys"');
    expect(html).not.toContain("<dialog");
  });

  it("starts empty: no secret from a previous creation", () => {
    const html = renderToStaticMarkup(<ApiKeyCreateForm canCreateService messages={{}} />);

    expect(html).not.toContain("API key created");
    expect(html).not.toContain("Copy this key now.");
    expect(html).toContain("Create API key");
  });

  it("does not offer service keys to an admin", () => {
    const html = renderToStaticMarkup(<ApiKeyCreateForm canCreateService={false} messages={{}} />);

    expect(html).toContain('value="delegated"');
    expect(html).not.toContain('value="service"');
    expect(html).not.toContain("api-key-role-cap");
  });

  it("offers service creation to a super_admin", () => {
    const html = renderToStaticMarkup(<ApiKeyCreateForm canCreateService messages={{}} />);

    expect(html).toContain('value="service"');
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

  it("never offers maintenance:run to a delegated key", () => {
    const html = fields("delegated", "super_admin");

    expect(html).not.toContain('value="maintenance:run"');
    expect(html).not.toContain('value="users:deactivate"');
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
});

describe("apiKeyFormReducer", () => {
  const superAdminService = apiKeyFormReducer(
    apiKeyFormReducer(INITIAL_API_KEY_FORM_STATE, { type: "kind", kind: "service" }),
    { type: "role-cap", roleCap: "super_admin" },
  );

  it("starts delegated with no role cap and no scopes", () => {
    expect(INITIAL_API_KEY_FORM_STATE).toEqual({
      kind: "delegated",
      roleCap: "",
      scopes: [],
    });
  });

  it("requires a role cap again when the kind becomes service", () => {
    const service = apiKeyFormReducer(
      { kind: "delegated", roleCap: "admin", scopes: ["users:read"] },
      { type: "kind", kind: "service" },
    );

    expect(service.roleCap).toBe("");
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
