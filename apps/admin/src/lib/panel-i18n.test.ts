import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDictionary } from "@027apps/i18n/dictionary.js";

const queryMock = vi.fn();
const loggerMock = vi.fn();

vi.mock("@/lib/api/door", () => ({
  getInfra: async () => ({
    deps: { logger: loggerMock },
    settingsDeps: { db: { query: queryMock } },
  }),
}));

import { loadPanelMessages } from "./panel-i18n";

beforeEach(() => {
  queryMock.mockReset();
  loggerMock.mockReset();
});

describe("loadPanelMessages", () => {
  it("falls back to the packaged dictionary when the table has no rows", async () => {
    queryMock.mockResolvedValue({ rows: [] });

    const messages = await loadPanelMessages("es");

    expect(messages).toEqual(getDictionary("es"));
    expect(Object.keys(messages).length).toBeGreaterThan(0);
    expect(messages["Members"]).toBe("Miembros");
    expect(queryMock).toHaveBeenCalledWith(expect.stringContaining("public.translations"), ["es"]);
  });

  it("overlays runtime rows on top of the packaged dictionary", async () => {
    queryMock.mockResolvedValue({
      rows: [
        { text_en: "Members", translated_text: "Miembros (editado)" },
        { text_en: "Settings", translated_text: "Ajustes" },
      ],
    });

    const messages = await loadPanelMessages("es");

    expect(messages["Members"]).toBe("Miembros (editado)");
    expect(messages["Settings"]).toBe("Ajustes");
    // Packaged strings that the table does not override are still served.
    expect(messages["Dashboard"]).toBe(getDictionary("es")["Dashboard"]);
  });

  it("serves English as an empty base plus runtime overrides", async () => {
    queryMock.mockResolvedValue({ rows: [{ text_en: "Dashboard", translated_text: "Tablero" }] });

    await expect(loadPanelMessages("en")).resolves.toEqual({ Dashboard: "Tablero" });
    expect(queryMock).toHaveBeenCalledWith(expect.stringContaining("public.translations"), ["en"]);
  });

  it("degrades to the packaged dictionary and logs when the database fails", async () => {
    queryMock.mockRejectedValue(new Error("connection refused"));

    await expect(loadPanelMessages("de")).resolves.toEqual(getDictionary("de"));
    expect(loggerMock).toHaveBeenCalledTimes(1);
    expect(loggerMock).toHaveBeenCalledWith(
      expect.objectContaining({ level: "warn", message: expect.stringContaining("bundled dictionary") }),
    );
  });
});
