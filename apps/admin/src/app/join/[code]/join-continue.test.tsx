import { describe, expect, it } from "vitest";
import { errorCopy } from "./join-continue";

describe("JoinContinue error copy", () => {
  it("names the full-club state for a quota-exhausted exchange", () => {
    expect(errorCopy("invitation_quota_exhausted", {})).toBe(
      "No seats left. Ask the administrator for more.",
    );
  });

  it("names a used code", () => {
    expect(errorCopy("join_code_used", {})).toBe("This invitation has already been used.");
  });

  it("falls back to the generic invalid-or-expired card", () => {
    expect(errorCopy(undefined, {})).toBe(
      "The link is not valid or has expired. Request a new one.",
    );
    expect(errorCopy("some_other_error", {})).toBe(
      "The link is not valid or has expired. Request a new one.",
    );
  });
});
