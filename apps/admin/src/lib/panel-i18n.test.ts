import { beforeEach, describe, expect, it, vi } from "vitest";

const queryMock = vi.fn();

vi.mock("@/lib/api/door", () => ({
  getInfra: async () => ({ settingsDeps: { db: { query: queryMock } } }),
}));

import { loadPanelMessages } from "./panel-i18n";

beforeEach(() => {
  queryMock.mockReset();
});

describe("loadPanelMessages", () => {
  it("builds the translation map from the locale rows", async () => {
    queryMock.mockResolvedValue({
      rows: [
        { text_en: "Members", translated_text: "Miembros" },
        { text_en: "Settings", translated_text: "Ajustes" },
      ],
    });

    await expect(loadPanelMessages("es")).resolves.toEqual({
      Members: "Miembros",
      Settings: "Ajustes",
    });
    expect(queryMock).toHaveBeenCalledWith(expect.stringContaining("public.translations"), ["es"]);
  });

  it("returns an empty map for English without querying", async () => {
    await expect(loadPanelMessages("en")).resolves.toEqual({});
    expect(queryMock).not.toHaveBeenCalled();
  });

  it("degrades to English keys when the database fails", async () => {
    queryMock.mockRejectedValue(new Error("connection refused"));

    await expect(loadPanelMessages("de")).resolves.toEqual({});
  });
});
