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
} from "./api-key-create-form";

function fields(kind: "service" | "delegated", roleCap: "admin" | "super_admin" = "admin") {
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
      <ApiKeyScopeChoices kind={kind} roleCap={roleCap} fieldErrors={{}} messages={{}} />
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
