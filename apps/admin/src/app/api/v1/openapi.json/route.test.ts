import { describe, expect, it } from "vitest";
import { GET } from "./route";

describe("GET /api/v1/openapi.json", () => {
  it("serves the generated document as public JSON", async () => {
    const response = GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(response.headers.get("cache-control")).toBe("public, max-age=300");

    const body = (await response.json()) as { openapi?: string; paths?: Record<string, unknown> };
    expect(body.openapi).toBe("3.1.0");
    expect(body.paths).toBeTypeOf("object");
    expect(body.paths).toHaveProperty("/health");
    expect(body.paths).toHaveProperty("/users");
  });
});
