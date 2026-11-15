import { describe, expect, it, vi } from "vitest";

const permanentRedirectMock = vi.fn((_href: string) => {
  throw new Error("NEXT_REDIRECT");
});

vi.mock("next/navigation", () => ({
  permanentRedirect: (href: string) => permanentRedirectMock(href),
}));

import LegacyModulePage from "./page";

describe("legacy module page", () => {
  it("sends an old page route to the module workspace", async () => {
    await expect(
      LegacyModulePage({ params: Promise.resolve({ key: "owe-no", route: "groups" }) }),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(permanentRedirectMock).toHaveBeenCalledWith("/panel/owe-no/groups");
  });

  it("sends the old settings path to the module card", async () => {
    await expect(
      LegacyModulePage({ params: Promise.resolve({ key: "owe-no", route: "settings" }) }),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(permanentRedirectMock).toHaveBeenCalledWith("/panel/modules/owe-no");
  });
});
