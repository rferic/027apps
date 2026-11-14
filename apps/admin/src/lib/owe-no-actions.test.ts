import { beforeEach, describe, expect, it, vi } from "vitest";

const requirePanelMock = vi.fn();
const redirectMock = vi.fn((url: string) => {
  throw new Error(`REDIRECT:${url}`);
});
const revalidatePathMock = vi.fn();
const adminAddMemberMock = vi.fn();
const adminCreateGroupMock = vi.fn();

vi.mock("next/navigation", () => ({
  redirect: (url: string) => redirectMock(url),
}));
vi.mock("next/cache", () => ({ revalidatePath: (path: string) => revalidatePathMock(path) }));
vi.mock("@/lib/panel-guard", () => ({ requirePanel: () => requirePanelMock() }));
vi.mock("@/lib/owe-no", () => ({ oweDeps: async () => ({ owe: { db: {} } }) }));
vi.mock("@027apps/owe-no/domain/admin.js", () => ({
  adminAddMember: (...args: unknown[]) => adminAddMemberMock(...args),
  adminCreateGroup: (...args: unknown[]) => adminCreateGroupMock(...args),
  adminLinkMember: vi.fn(),
  adminRemoveMember: vi.fn(),
  adminSetArchived: vi.fn(),
  adminCreateMovement: vi.fn(),
  adminUpdateMovement: vi.fn(),
  adminDeleteMovement: vi.fn(),
}));

import { addMemberAction, createGroupAction } from "./owe-no-actions";
import { OweDomainError } from "@027apps/owe-no/domain/service.js";

const GROUP = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  vi.clearAllMocks();
  requirePanelMock.mockResolvedValue({ user: { id: "admin-1", role: "admin" } });
});

describe("owe-no panel actions", () => {
  it("keeps the group open after adding a member", async () => {
    adminAddMemberMock.mockResolvedValue({});
    const data = new FormData();
    data.set("group", GROUP);
    data.set("display_name", "Marta");

    await expect(addMemberAction(data)).rejects.toThrow(`REDIRECT:/panel/owe-no/groups?group=${GROUP}`);
    expect(adminAddMemberMock).toHaveBeenCalledOnce();
  });

  it("shows the refusal on the same group, never at the list", async () => {
    adminAddMemberMock.mockRejectedValue(
      new OweDomainError("conflict", "settle first", { code: "member_has_balance" }),
    );
    const data = new FormData();
    data.set("group", GROUP);
    data.set("display_name", "Marta");

    await expect(addMemberAction(data)).rejects.toThrow(
      `REDIRECT:/panel/owe-no/groups?error=member_has_balance&group=${GROUP}`,
    );
  });

  it("lands on the new group after creating it", async () => {
    adminCreateGroupMock.mockResolvedValue({ id: "22222222-2222-4222-8222-222222222222" });
    const data = new FormData();
    data.set("name", "Casa");
    data.set("currency", "EUR");

    await expect(createGroupAction(data)).rejects.toThrow(
      "REDIRECT:/panel/owe-no/groups?group=22222222-2222-4222-8222-222222222222",
    );
  });

  it("refuses a malformed currency without calling the domain", async () => {
    const data = new FormData();
    data.set("name", "Casa");
    data.set("currency", "EURO");

    await expect(createGroupAction(data)).rejects.toThrow(
      "REDIRECT:/panel/owe-no/groups?error=validation_failed&new=1",
    );
    expect(adminCreateGroupMock).not.toHaveBeenCalled();
  });
});
