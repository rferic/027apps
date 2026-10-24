import { describe, expect, it } from "vitest";
import { APP_NAME } from "./brand";

describe("brand", () => {
  it("expone el nombre de la app", () => {
    expect(APP_NAME).toBe("027Apps");
  });
});
