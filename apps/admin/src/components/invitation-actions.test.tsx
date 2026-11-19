import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => undefined }) }));

import { InvitationActions } from "./invitation-actions";

describe("InvitationActions", () => {
  it("offers resend and link regeneration for an admin invitation", () => {
    const html = renderToStaticMarkup(
      <InvitationActions id="i1" publicUrl="https://panel.test" source="admin" messages={{}} />,
    );

    expect(html).toContain("Resend email");
    expect(html).toContain("Generate new link");
    expect(html).toContain("The previous link stops working.");
  });

  it("hides renew, rotate and resend for member and qr invitations", () => {
    for (const source of ["member", "qr"] as const) {
      const html = renderToStaticMarkup(
        <InvitationActions
          id="i1"
          publicUrl="https://panel.test"
          source={source}
          messages={{}}
        />,
      );

      expect(html).not.toContain("Resend email");
      expect(html).not.toContain("Generate new link");
      expect(html).toContain("This invitation can only be revoked.");
    }
  });
});
