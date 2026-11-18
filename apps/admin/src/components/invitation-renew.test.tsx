import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => undefined }) }));

import { InvitationRenew } from "./invitation-renew";

describe("InvitationRenew", () => {
  it("explains the renewal and shows the initial action", () => {
    const html = renderToStaticMarkup(
      <InvitationRenew id="i1" publicUrl="https://panel.test" messages={{}} />,
    );

    expect(html).toContain("Renew invitation");
    expect(html).toContain("This invitation expired.");
    expect(html).toContain("the previous link stops working");
    // The confirmation only appears after the click.
    expect(html).not.toContain("The previous link will stop working. Continue?");
  });
});
