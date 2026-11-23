import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePanel: vi.fn(),
  commitImport: vi.fn(),
}));

vi.mock("@/lib/panel-guard", () => ({ requirePanel: mocks.requirePanel }));
vi.mock("@/lib/owe-no", () => ({ oweDeps: async () => ({ owe: { db: {} } }) }));
vi.mock("@027apps/owe-no/domain/importer.js", () => ({
  commitImport: mocks.commitImport,
  importMappingOptions: vi.fn(),
  previewImport: vi.fn(),
}));
vi.mock("@027apps/owe-no/domain/service.js", () => ({
  OweDomainError: class OweDomainError extends Error {},
}));

import { importCommitAction } from "./owe-no-import-actions";

/**
 * The wizard used to create the mapping's members before committing, so a
 * failed or cancelled import left the group with new people. The names now
 * travel with the commit and the domain creates them inside the import's own
 * transaction.
 */
describe("import commit action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePanel.mockResolvedValue({ user: { id: "admin-1", role: "admin" } });
    mocks.commitImport.mockResolvedValue({
      created: 1,
      skipped_duplicates: 0,
      errors: 0,
      categories: 0,
    });
  });

  it("sends an existing member as a plain mapping", async () => {
    const result = await importCommitAction("group-1", "csv", {
      Ana: { member_id: "member-ana", display_name: "Ana" },
    });

    expect(result).toMatchObject({ ok: true });
    expect(mocks.commitImport).toHaveBeenCalledWith({ db: {} }, "admin-1", "group-1", "csv", {
      mapping: { Ana: "member-ana" },
      confirmDuplicates: false,
    });
  });

  it("defers a new person to the commit instead of creating it first", async () => {
    const result = await importCommitAction("group-1", "csv", {
      Luis: { user_id: "user-luis", display_name: "Luis Pérez" },
      Bolli: { display_name: "Bolli" },
    });

    expect(result).toMatchObject({ ok: true });
    expect(mocks.commitImport).toHaveBeenCalledWith({ db: {} }, "admin-1", "group-1", "csv", {
      newMembers: [
        { name: "Luis", displayName: "Luis Pérez", userId: "user-luis" },
        { name: "Bolli" },
      ],
      confirmDuplicates: false,
    });
  });

  it("keeps the file's own name when the choice does not rename it", async () => {
    await importCommitAction("group-1", "csv", {
      Bolli: { display_name: "Bolli" },
    });

    expect(mocks.commitImport).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(String),
      expect.any(String),
      expect.any(String),
      {
        newMembers: [{ name: "Bolli" }],
        confirmDuplicates: false,
      },
    );
  });
});
