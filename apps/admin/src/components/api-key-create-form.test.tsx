import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
}));

import { ApiKeyCreateDialog } from "./api-key-create-form";

const BASE = {
  dialogRef: { current: null },
  canCreateService: false,
  kind: "delegated" as const,
  creating: false,
  created: false,
  secret: null,
  copied: false,
  error: null,
  fieldErrors: {},
  onKindChange: () => {},
  onCancel: () => {},
  onDismiss: () => {},
  onClosed: () => {},
  onCopy: () => {},
  onSubmit: () => {},
  messages: {},
};

describe("ApiKeyCreateDialog", () => {
  it("hides the form once the secret exists and leaves only Done", () => {
    const html = renderToStaticMarkup(
      <ApiKeyCreateDialog {...BASE} created secret="027_svc_abc" />,
    );

    expect(html).toContain("027_svc_abc");
    expect(html).toContain("Copy this key now. It will not be shown again.");
    expect(html).toContain("Done");
    expect(html).not.toContain("<form");
    expect(html).not.toContain("Create API key<");
    expect(html).not.toContain("api-key-name");
  });

  it("keeps the form while there is no secret", () => {
    const html = renderToStaticMarkup(<ApiKeyCreateDialog {...BASE} />);

    expect(html).toContain("<form");
    expect(html).toContain("api-key-name");
    expect(html).toContain("Cancel");
  });

  it("does not offer service keys to an admin", () => {
    const html = renderToStaticMarkup(<ApiKeyCreateDialog {...BASE} />);

    expect(html).toContain('value="delegated"');
    expect(html).not.toContain('value="service"');
    expect(html).not.toContain("api-key-role-cap");
  });

  it("offers service keys and a role cap to a super_admin", () => {
    const html = renderToStaticMarkup(
      <ApiKeyCreateDialog {...BASE} canCreateService kind="service" />,
    );

    expect(html).toContain('value="service"');
    expect(html).toContain("api-key-role-cap");
    expect(html).toContain('value="super_admin"');
  });

  it("does not leave a second creation path when the API returned no secret", () => {
    const html = renderToStaticMarkup(<ApiKeyCreateDialog {...BASE} created />);

    expect(html).toContain("The key was created but the API did not return the secret.");
    expect(html).toContain("Done");
    expect(html).not.toContain("<form");
  });
});
