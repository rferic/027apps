import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
}));

import { InvitationCreateForm, InvitationCreatedPanel } from "./invitation-create-form";

const CATEGORIES = [{ id: "c1", name: "Familia" }];
const MODULES = [{ key: "expenses", name: "Expenses" }];

describe("InvitationCreateForm", () => {
  it("renders the fields on a page, not inside a creation dialog", () => {
    const html = renderToStaticMarkup(
      <InvitationCreateForm categories={CATEGORIES} modules={MODULES} messages={{}} />,
    );

    expect(html).toContain("<form");
    expect(html).toContain("invitation-email");
    expect(html).toContain("invitation-category");
    expect(html).toContain("Cancel");
    expect(html).toContain('href="/invitations"');
    expect(html).not.toContain("<dialog");
  });

  it("warns when the category or module options could not be read", () => {
    const html = renderToStaticMarkup(
      <InvitationCreateForm
        categories={[]}
        modules={[]}
        optionsUnavailable
        messages={{}}
      />,
    );

    expect(html).toContain("Some category or module options are unavailable right now.");
  });
});

describe("InvitationCreatedPanel", () => {
  it("shows the one-time token on the page with copy and a Done link to the list", () => {
    const html = renderToStaticMarkup(
      <InvitationCreatedPanel token="tok-123" copied={false} onCopy={() => {}} messages={{}} />,
    );

    expect(html).toContain("tok-123");
    expect(html).toContain("Copy this token now. It will not be shown again.");
    expect(html).toContain("Copy token");
    expect(html).toContain('href="/invitations"');
    expect(html).toContain("Done");
    expect(html).not.toContain("<form");
    expect(html).not.toContain("invitation-email");
    expect(html).not.toContain("Create invitation<");
  });

  it("does not leave a second creation path when the API returned no token", () => {
    const html = renderToStaticMarkup(
      <InvitationCreatedPanel token={null} copied={false} onCopy={() => {}} messages={{}} />,
    );

    expect(html).toContain("The invitation was created but the API did not return a token.");
    expect(html).toContain("Done");
    expect(html).not.toContain("<form");
  });
});
