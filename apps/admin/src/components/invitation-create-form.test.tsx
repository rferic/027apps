import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
}));

import {
  InvitationCreateForm,
  InvitationCreatedPanel,
} from "./invitation-create-form";

const CATEGORIES = [{ id: "c1", name: "Familia" }];
const MODULES = [{ key: "expenses", name: "Expenses" }];
const PANEL_ACTIONS = {
  onCopy: () => {},
  onCreateAnother: () => {},
  onConfirmAnother: () => {},
  onCancelAnother: () => {},
};

describe("InvitationCreateForm", () => {
  it("renders the fields on a page, not inside a creation dialog", () => {
    const html = renderToStaticMarkup(
      <InvitationCreateForm categories={CATEGORIES} modules={MODULES} defaultLocale="es"
        messages={{}} />,
    );

    expect(html).toContain("<form");
    // The form is page content, so it needs a surface of its own on wide screens.
    expect(html).toMatch(/<form[^>]*rounded-card[^>]*bg-surface/);
    expect(html).toContain("invitation-email");
    expect(html).toContain("invitation-category");
    expect(html).toContain("invitation-delivery");
    expect(html).toContain("invitation-locale");
    expect(html).toContain("Cancel");
    expect(html).toContain('href="/invitations"');
    expect(html).not.toContain("<dialog");
  });

  it("starts empty: no token from a previous creation", () => {
    const html = renderToStaticMarkup(
      <InvitationCreateForm categories={CATEGORIES} modules={MODULES} defaultLocale="es"
        messages={{}} />,
    );

    expect(html).not.toContain("Invitation created");
    expect(html).not.toContain("Copy this token now.");
    expect(html).toContain("Create invitation");
  });

  it("warns when the category or module options could not be read", () => {
    const html = renderToStaticMarkup(
      <InvitationCreateForm
        categories={[]}
        modules={[]}
        optionsUnavailable
        defaultLocale="es"
        messages={{}}
      />,
    );

    expect(html).toContain("Some category or module options are unavailable right now.");
  });
});

describe("InvitationCreatedPanel", () => {
  it("asks for a manual copy when the clipboard copy failed (insecure context)", () => {
    const html = renderToStaticMarkup(
      <InvitationCreatedPanel
        token="tok-123"
        copied={false}
        copyFailed
        {...PANEL_ACTIONS}
        messages={{}}
      />,
    );

    expect(html).toContain("Select the text and copy it manually.");
    expect(html).toContain("tok-123");
  });

  it("shows the one-time token on the page with copy and a Done link to the list", () => {
    const html = renderToStaticMarkup(
      <InvitationCreatedPanel
        token="tok-123"
        copied={false}
        {...PANEL_ACTIONS}
        messages={{}}
      />,
    );

    expect(html).toContain("tok-123");
    expect(html).toContain("Copy this token now. It will not be shown again.");
    expect(html).toContain("Copy token");
    expect(html).toContain(
      "The invitee opens the invitation link in the browser or redeems the token from the mobile app to join the instance.",
    );
    expect(html).toContain('href="/invitations"');
    expect(html).toContain("Done");
    expect(html).not.toContain("<form");
    expect(html).not.toContain("invitation-email");
    expect(html).not.toContain("Create invitation<");
  });

  it("does not leave a second creation path when the API returned no token", () => {
    const html = renderToStaticMarkup(
      <InvitationCreatedPanel
        token={null}
        copied={false}
        {...PANEL_ACTIONS}
        messages={{}}
      />,
    );

    expect(html).toContain("The invitation was created but the API did not return a token.");
    expect(html).toContain("Done");
    expect(html).not.toContain("<form");
  });
});

describe("InvitationCreatedPanel create another", () => {
  it("offers Create another next to Done", () => {
    const html = renderToStaticMarkup(
      <InvitationCreatedPanel
        token="tok-123"
        copied={false}
        {...PANEL_ACTIONS}
        messages={{}}
      />,
    );

    expect(html).toContain("Create another");
    expect(html).toContain("Done");
    expect(html).not.toContain("The token won't be shown again.");
  });

  it("asks inline before dropping a token that was not copied", () => {
    const html = renderToStaticMarkup(
      <InvitationCreatedPanel
        token="tok-123"
        copied={false}
        confirmingAnother
        {...PANEL_ACTIONS}
        messages={{}}
      />,
    );

    expect(html).toContain("The token won&#x27;t be shown again.");
    expect(html).toContain("Cancel");
    expect(html).toContain("tok-123");
  });
});
