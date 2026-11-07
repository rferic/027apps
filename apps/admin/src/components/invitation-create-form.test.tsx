import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
}));

import { InvitationCreateDialog } from "./invitation-create-form";

const BASE = {
  dialogRef: { current: null },
  categories: [{ id: "c1", name: "Familia" }],
  modules: [{ key: "expenses", name: "Expenses" }],
  optionsUnavailable: false,
  creating: false,
  created: false,
  token: null,
  copied: false,
  error: null,
  fieldErrors: {},
  onCancel: () => {},
  onDismiss: () => {},
  onClosed: () => {},
  onCopy: () => {},
  onSubmit: () => {},
  messages: {},
};

describe("InvitationCreateDialog", () => {
  it("hides the creation form once the token exists", () => {
    const html = renderToStaticMarkup(
      <InvitationCreateDialog {...BASE} created token="tok-123" />,
    );

    expect(html).toContain("tok-123");
    expect(html).toContain("Done");
    expect(html).not.toContain("<form");
    expect(html).not.toContain("invitation-email");
    expect(html).not.toContain("Create invitation<");
  });

  it("keeps the creation form while there is no token", () => {
    const html = renderToStaticMarkup(<InvitationCreateDialog {...BASE} />);

    expect(html).toContain("<form");
    expect(html).toContain("invitation-email");
    expect(html).toContain("Cancel");
  });
});
