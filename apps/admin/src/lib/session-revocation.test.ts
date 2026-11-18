import { describe, expect, it, vi } from "vitest";
import { revokeSessions } from "./session-revocation";

/**
 * Deactivating, deleting or expelling a member has to end their refresh
 * sessions: the profile check covers what is already issued, and this delete is
 * what stops the next refresh from working at all.
 */
describe("revokeSessions", () => {
  it("drops every refresh session of that user", async () => {
    const query = vi.fn(async () => ({ rows: [] }));

    await revokeSessions({ query })("u-1");

    expect(query).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenCalledWith("delete from auth.sessions where user_id = $1", ["u-1"]);
  });
});
