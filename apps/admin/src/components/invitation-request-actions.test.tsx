import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
}));

vi.mock("@/lib/invitation-request-mutations", () => ({
  approveInvitationRequest: vi.fn(),
  rejectInvitationRequest: vi.fn(),
}));

import { InvitationRequestActions, requestActionFailureMessage } from "./invitation-request-actions";

describe("InvitationRequestActions", () => {
  it("offers approve with the requested amount as the default", () => {
    const html = renderToStaticMarkup(
      <InvitationRequestActions layout="table" id="r1" amount={2} messages={{}} />,
    );

    expect(html).toContain("Approve 2 seat(s)");
    expect(html).toContain("Reject");
    expect(html).toContain('value="2"');
    expect(html).toContain('id="approve-amount-table-r1"');
    // A text field with numeric hints, not `type="number"`: the draft has to be
    // able to stay empty while typing, or clearing it snaps back to "0".
    expect(html).toContain('type="text"');
    expect(html).toContain('pattern="[0-9]*"');
    expect(html).not.toContain('type="number"');
  });

  it("asks for an optional reason when rejecting", () => {
    const html = renderToStaticMarkup(
      <InvitationRequestActions layout="table" id="r1" amount={2} messages={{}} />,
    );

    expect(html).toContain("Reason (optional)");
    expect(html).toContain('id="reject-reason-table-r1"');
  });
});

describe("requestActionFailureMessage", () => {
  it("maps request_resolved to a message about the second click", () => {
    expect(requestActionFailureMessage("request_resolved", {})).toBe(
      "This request was already resolved.",
    );
  });

  it("keeps a generic message for unknown or missing codes", () => {
    expect(requestActionFailureMessage(undefined, {})).toBe("We couldn't update the request.");
    expect(requestActionFailureMessage("rate_limited", {})).toBe(
      "Wait a moment before trying again.",
    );
  });
});
