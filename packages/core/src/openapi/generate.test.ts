import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { userPatchSchema } from "../users/api";
import { buildOpenApiDocument, serializeOpenApiDocument, type JsonObject } from "./generate";
import { OPERATIONS } from "./registry";
import { errorResponseSchema } from "./schemas";

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

  it("documents limit/offset on every paginated list", () => {
    const document = buildOpenApiDocument();
    for (const path of ["/users", "/user-categories", "/invitations", "/api-keys", "/modules"]) {
      const get = record(record(record(document.paths)[path]).get);
      const parameters = (get.parameters ?? []) as JsonRecord[];
      const names = parameters.filter((parameter) => parameter.in === "query").map((p) => p.name);
      expect(names).toContain("limit");
      expect(names).toContain("offset");
      if (path === "/users") expect(names).toContain("q");
    }
  });

  it("documents the role and state filters of GET /users", () => {
    const document = buildOpenApiDocument();
    const get = record(record(record(document.paths)["/users"]).get);
    const parameters = (get.parameters ?? []) as JsonRecord[];
    const byName = new Map(parameters.map((parameter) => [parameter.name, parameter]));
    expect(byName.has("role")).toBe(true);
    expect(byName.has("state")).toBe(true);
    expect(JSON.stringify(byName.get("role"))).toContain("super_admin");
    expect(JSON.stringify(byName.get("state"))).toContain("deactivated");
  });

  it("documents POST /users/{id}/restore under the deactivation scope", () => {
    const document = buildOpenApiDocument();
    const restore = record(record(record(document.paths)["/users/{id}/restore"]).post);
    expect(restore["x-027-scopes"]).toEqual(["users:deactivate"]);
    const success = record(record(restore.responses)["200"]);
    const schema = record(record(record(success.content)["application/json"]).schema);
    expect(schema.$ref).toBe("#/components/schemas/UserResponse");
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

  it("publishes the credentials each operation actually accepts", () => {
    const expected: Record<string, JsonObject[]> = {
      public: [],
      session: [{ sessionAuth: [] }, { apiKeyAuth: [] }],
      "session-only": [{ sessionAuth: [] }],
      key: [{ apiKeyAuth: [] }],
      "service-key": [{ apiKeyAuth: [] }],
    };
    const document = buildOpenApiDocument();
    for (const operation of OPERATIONS) {
      const path = record(record(record(document.paths)[operation.path])[operation.method]);
      expect(path.security).toEqual(expected[operation.auth]);
    }
  });

  it("marks the operations that only accept one credential type", () => {
    const document = buildOpenApiDocument();
    const operation = (path: string, method: string): JsonRecord =>
      record(record(record(document.paths)[path])[method]);

    expect(operation("/setup/test-email", "post").security).toEqual([{ sessionAuth: [] }]);
    expect(operation("/maintenance/status", "get").security).toEqual([{ sessionAuth: [] }]);
    expect(operation("/maintenance/run", "post").security).toEqual([{ apiKeyAuth: [] }]);
    expect(operation("/users", "get").security).toEqual([
      { sessionAuth: [] },
      { apiKeyAuth: [] },
    ]);
  });

  it("accepts an object in ErrorResponse.details and rejects an array", () => {
    const envelope = {
      error: {
        code: "validation_failed",
        message: "Validation failed",
        request_id: "6f1c2a8e-8f14-4d2b-9b3e-1f7a8d2c4b6a",
        details: { formErrors: [], fieldErrors: { email: ["must be a valid email"] } },
      },
    };
    expect(errorResponseSchema.safeParse(envelope).success).toBe(true);

    const asArray = { ...envelope, error: { ...envelope.error, details: [] } };
    expect(errorResponseSchema.safeParse(asArray).success).toBe(false);

    const components = record(record(buildOpenApiDocument().components).schemas);
    const details = record(record(record(record(components.ErrorResponse).properties).error).properties)
      .details;
    expect(record(details).type).toBe("object");
    expect(record(details).additionalProperties).toBeDefined();
  });

  it("documents health 503 with the Health schema and no default error", () => {
    const document = buildOpenApiDocument();
    const responses = record(record(record(record(document.paths)["/health"]).get).responses);
    expect(responses).toHaveProperty("503");
    expect(responses).not.toHaveProperty("default");

    const schema = record(record(record(responses["503"]).content)["application/json"]).schema;
    expect(record(schema).$ref).toBe("#/components/schemas/Health");
  });

  it("documents the translations 304 revalidation response", () => {
    const document = buildOpenApiDocument();
    const responses = record(record(record(record(document.paths)["/translations"]).get).responses);
    expect(responses).toHaveProperty("304");
    expect(record(responses["304"]).content).toBeUndefined();
  });

  it("marks optional request bodies as not required", () => {
    const document = buildOpenApiDocument();
    const requestBody = (path: string, method: string): JsonRecord =>
      record(record(record(record(document.paths)[path])[method]).requestBody);

    expect(requestBody("/modules/{key}/uninstall", "post").required).toBe(false);
    expect(requestBody("/maintenance/run", "post").required).toBe(false);
    expect(requestBody("/setup/super-admin", "post").required).toBe(true);
  });

  it("documents that PATCH /users/{id} requires at least one property", () => {
    const document = buildOpenApiDocument();
    const patch = record(record(record(document.paths)["/users/{id}"]).patch);
    const body = record(record(record(patch.requestBody).content)["application/json"]);
    expect(record(body.schema).$ref).toBe("#/components/schemas/UserPatch");

    const components = record(record(document.components).schemas);
    expect(record(components.UserPatch).minProperties).toBe(1);
    // The documented rule matches the runtime schema (empty PATCH is a 400).
    expect(userPatchSchema.safeParse({}).success).toBe(false);
  });
});
