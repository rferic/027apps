import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => undefined }) }));

import { InvitationActions } from "./invitation-actions";

describe("InvitationActions", () => {
  it("offers resend and link regeneration for a pending invitation", () => {
    const html = renderToStaticMarkup(
      <InvitationActions id="i1" publicUrl="https://panel.test" messages={{}} />,
    );

    expect(html).toContain("Resend email");
    expect(html).toContain("Generate new link");
    expect(html).toContain("The previous link stops working.");
  });
});
