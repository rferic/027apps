import { describe, expect, it, vi } from "vitest";
import { completeRevoke } from "./api-key-revoke-button";

describe("completeRevoke", () => {
  it("returns to the list after revoking from the detail page", async () => {
    const router = { push: vi.fn(), refresh: vi.fn() };

    await completeRevoke(router, "/keys");

    expect(router.push).toHaveBeenCalledWith("/keys");
    expect(router.refresh).toHaveBeenCalled();
  });

  it("stays on the current page when no redirect is requested", async () => {
    const router = { push: vi.fn(), refresh: vi.fn() };

    await completeRevoke(router);

    expect(router.push).not.toHaveBeenCalled();
    expect(router.refresh).toHaveBeenCalled();
  });
});
