import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildOpenApiDocument, serializeOpenApiDocument, type JsonObject } from "./generate";
import { OPERATIONS } from "./registry";

const COMMITTED = fileURLToPath(new URL("../../../../docs/api/openapi.json", import.meta.url));

type JsonRecord = Record<string, unknown>;

function record(value: unknown): JsonRecord {
  return (value ?? {}) as JsonRecord;
}

describe("OpenAPI generation", () => {
  it("is deterministic: two generations produce the same string", () => {
    expect(serializeOpenApiDocument()).toBe(serializeOpenApiDocument());
  });

  it("emits the OpenAPI version, servers and security schemes", () => {
    const document = buildOpenApiDocument();
    expect(document.openapi).toBe("3.1.0");
    expect(document.servers).toEqual([{ url: "/api/v1", description: "This instance" }]);

    const components = record(document.components);
    const schemes = record(components.securitySchemes);
    expect(record(schemes.sessionAuth).scheme).toBe("bearer");
    expect(record(schemes.apiKeyAuth).scheme).toBe("bearer");
  });

  it("contains a known path with its request and response schema references", () => {
    const document = buildOpenApiDocument();
    const paths = record(document.paths);
    const users = record(paths["/users"]);
    const get = record(users.get);
    const responses = record(get.responses);
    const success = record(responses["200"]);
    const content = record(success.content);
    const schema = record(record(content["application/json"]).schema);

    expect(schema.$ref).toBe("#/components/schemas/UserList");
    expect(get["x-027-scopes"]).toEqual(["users:read"]);

    const components = record(record(document.components).schemas);
    expect(components.UserList).toBeDefined();
    expect(components.User).toBeDefined();
    expect(components.ErrorResponse).toBeDefined();
  });

  it("documents role changes through PATCH /users/{id} with the shared zod schema", () => {
    const document = buildOpenApiDocument();
    const patch = record(record(record(document.paths)["/users/{id}"]).patch);
    const parameters = patch.parameters as Array<JsonRecord>;
    expect(parameters.map((parameter) => parameter.name)).toEqual(["id"]);

    const body = record(record(record(patch.requestBody).content)["application/json"]);
    expect(record(body.schema).$ref).toBe("#/components/schemas/UserPatch");
  });

  it("omits response bodies for 204 operations", () => {
    const document = buildOpenApiDocument();
    const paths = record(document.paths);
    const revoke = record(record(record(paths["/api-keys/{id}"]).delete).responses);
    expect(record(revoke["204"]).content).toBeUndefined();
  });

  it("never publishes the API key secret in a list or detail representation", () => {
    const document = buildOpenApiDocument();
    const schemas = record(record(document.components).schemas);
    for (const name of ["ApiKey", "ApiKeyList", "ApiKeyResponse"]) {
      expect(JSON.stringify(schemas[name])).not.toContain('"secret"');
    }
    // The secret appears exactly once: the creation response.
    expect(record(schemas.ApiKeyCreated).properties).toHaveProperty("secret");
  });

  it("registers one operation per method and path", () => {
    const keys = OPERATIONS.map((operation) => `${operation.method} ${operation.path}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("keeps docs/api/openapi.json up to date", () => {
    const committed = readFileSync(COMMITTED, "utf8");
    expect(committed).toBe(serializeOpenApiDocument());
  });

  it("does not leak internal paths or secrets into the document", () => {
    const json = serializeOpenApiDocument();
    expect(json).not.toContain("node_modules");
    expect(json).not.toContain("process.env");
  });

  it("exposes every operation with a security requirement or explicitly public", () => {
    for (const operation of OPERATIONS) {
      const document = buildOpenApiDocument();
      const path = record(record(record(document.paths)[operation.path])[operation.method]);
      expect(Array.isArray(path.security)).toBe(true);
      expect((path.security as JsonObject[]).length).toBe(operation.auth === "public" ? 0 : 1);
    }
  });
});
