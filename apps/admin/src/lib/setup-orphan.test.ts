import { describe, expect, it } from "vitest";
import { isRecoverableOrphan } from "./setup-orphan";

const ORPHAN = { id: "u1", hasProfile: false };
const REAL_ACCOUNT = { id: "u2", hasProfile: true };
const REGISTERED = "A user with this email address has already been registered";

describe("isRecoverableOrphan", () => {
  it("recovers an orphan while the setup window is open", () => {
    expect(isRecoverableOrphan(REGISTERED, ORPHAN, true)).toBe(true);
  });

  it("never deletes a real account (it has a profile)", () => {
    expect(isRecoverableOrphan(REGISTERED, REAL_ACCOUNT, true)).toBe(false);
  });

  it("never deletes anything once setup is complete", () => {
    expect(isRecoverableOrphan(REGISTERED, ORPHAN, false)).toBe(false);
  });

  it("ignores unrelated errors", () => {
    expect(isRecoverableOrphan("Database error", ORPHAN, true)).toBe(false);
  });

  it("does nothing when the user cannot be found", () => {
    expect(isRecoverableOrphan(REGISTERED, null, true)).toBe(false);
  });
});
