import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z, type ZodType } from "zod";
import { CORE_VERSION } from "../version";
import { OPERATIONS, type OperationAuth, type OperationResponse } from "./registry";
import { componentName, componentOverride, namedComponents } from "./schemas";

/**
 * Builds the OpenAPI 3.1 document from the registry. The same command writes
 * the committed review copy (`docs/api/openapi.json`) and checks that it is up
 * to date; the running instance serves the generated string directly.
 */
export type JsonSchema = Record<string, unknown>;
export type JsonObject = { [key: string]: unknown };

const DOCUMENT_PATH = new URL("../../../../docs/api/openapi.json", import.meta.url);

const SECURITY_SCHEMES = {
  sessionAuth: {
    type: "http",
    scheme: "bearer",
    bearerFormat: "Supabase JWT",
    description: "The user's Supabase session (mobile or admin panel).",
  },
  apiKeyAuth: {
    type: "http",
    scheme: "bearer",
    bearerFormat: "027 API key",
    description: "An opaque 027_svc_/027_usr_ key, scoped and revocable instantly.",
  },
} as const;

const METHOD_ORDER = ["get", "post", "patch", "put", "delete"] as const;

/** Sorts object keys recursively so two generations are byte-identical. */
function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value === null || typeof value !== "object") return value;
  const input = value as JsonObject;
  const output: JsonObject = {};
  for (const key of Object.keys(input).sort((a, b) => a.localeCompare(b))) {
    output[key] = sortKeys(input[key]);
  }
  return output;
}

/**
 * `z.toJSONSchema` emits local `definitions` for recursive schemas (e.g.
 * `z.json()`). OpenAPI expects them under `components.schemas`, so they are
 * hoisted with a parent prefix and every local `$ref` is rewritten.
 */
function hoistDefinitions(
  name: string,
  schema: JsonSchema,
): { main: JsonSchema; extra: Record<string, JsonSchema> } {
  const { definitions, ...main } = schema;
  const extra: Record<string, JsonSchema> = {};
  if (!definitions || typeof definitions !== "object") return { main, extra };

  const prefix = `${name}__`;
  const rewrite = (value: unknown): unknown => {
    if (typeof value === "string") return value.replaceAll("#/definitions/", `#/components/schemas/${prefix}`);
    if (Array.isArray(value)) return value.map(rewrite);
    if (value === null || typeof value !== "object") return value;
    const output: JsonObject = {};
    for (const [key, entry] of Object.entries(value as JsonObject)) output[key] = rewrite(entry);
    return output;
  };

  for (const [definitionName, definition] of Object.entries(definitions as JsonObject)) {
    extra[`${prefix}${definitionName}`] = rewrite(definition) as JsonSchema;
  }
  return { main: rewrite(main) as JsonSchema, extra };
}

function toComponentSchema(schema: ZodType): JsonSchema {
  return z.toJSONSchema(schema, { target: "openapi-3.1", io: "output" }) as JsonSchema;
}

function schemaOrRef(schema: ZodType): JsonSchema {
  const name = componentName(schema);
  if (name) return { $ref: `#/components/schemas/${name}` };
  return toComponentSchema(schema);
}

function buildComponents(): Record<string, JsonSchema> {
  const schemas: Record<string, JsonSchema> = {};
  for (const { name, schema } of namedComponents()) {
    const { main, extra } = hoistDefinitions(name, toComponentSchema(schema));
    // Overrides add what zod cannot express after a refinement (`minProperties`).
    schemas[name] = { ...main, ...componentOverride(name) };
    Object.assign(schemas, extra);
  }
  return schemas;
}

function securityFor(auth: OperationAuth): Array<Record<string, string[]>> {
  switch (auth) {
    case "public":
      return [];
    case "session":
      // The door accepts either credential on ordinary routes.
      return [{ sessionAuth: [] }, { apiKeyAuth: [] }];
    case "session-only":
      return [{ sessionAuth: [] }];
    case "key":
    case "service-key":
      return [{ apiKeyAuth: [] }];
  }
}

function extraResponse(response: OperationResponse): JsonObject {
  const result: JsonObject = { description: response.description };
  if (response.schema) {
    result.content = { "application/json": { schema: schemaOrRef(response.schema) } };
  }
  return result;
}

function pathParameters(path: string): JsonObject[] {
  return [...path.matchAll(/\{([^}]+)\}/g)].map((match) => ({
    name: match[1],
    in: "path",
    required: true,
    schema: { type: "string" },
  }));
}

/** `query` is an object schema: every property becomes an `in: query` parameter. */
function queryParameters(operation: (typeof OPERATIONS)[number]): JsonObject[] {
  if (!operation.query) return [];
  const schema = z.toJSONSchema(operation.query, {
    target: "openapi-3.1",
    io: "input",
  }) as JsonSchema;
  const properties = (schema.properties ?? {}) as Record<string, JsonSchema>;
  const required = new Set<string>(
    Array.isArray(schema.required) ? (schema.required as string[]) : [],
  );
  return Object.entries(properties).map(([name, property]) => ({
    name,
    in: "query",
    required: required.has(name),
    schema: property,
  }));
}

function buildOperation(operation: (typeof OPERATIONS)[number]): JsonObject {
  const status = operation.status ?? 200;
  const success: JsonObject = {
    description:
      status === 204 ? "No content." : status === 201 ? "Created." : "Successful response.",
  };
  if (operation.response) {
    success.content = { "application/json": { schema: schemaOrRef(operation.response) } };
  }

  const responses: JsonObject = { [String(status)]: success };
  if (operation.errorDefault !== false) {
    responses.default = {
      description: "Error envelope (ADR 0007).",
      content: {
        "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } },
      },
    };
  }
  for (const [code, response] of Object.entries(operation.responses ?? {})) {
    responses[code] = extraResponse(response);
  }

  const parameters = [...pathParameters(operation.path), ...queryParameters(operation)];
  const result: JsonObject = {
    summary: operation.summary,
    security: securityFor(operation.auth),
    responses,
  };
  if (parameters.length > 0) result.parameters = parameters;
  if (operation.scopes.length > 0) result["x-027-scopes"] = [...operation.scopes];
  if (operation.request) {
    // A schema that accepts `undefined` (an optional body) is not required.
    result.requestBody = {
      required: !operation.request.safeParse(undefined).success,
      content: { "application/json": { schema: schemaOrRef(operation.request) } },
    };
  }
  return result;
}

export function buildOpenApiDocument(): JsonObject {
  const components = buildComponents();
  const paths: Record<string, JsonObject> = {};

  const ordered = [...OPERATIONS].sort((a, b) => {
    const byPath = a.path.localeCompare(b.path);
    if (byPath !== 0) return byPath;
    return METHOD_ORDER.indexOf(a.method) - METHOD_ORDER.indexOf(b.method);
  });

  for (const operation of ordered) {
    const path = paths[operation.path] ?? {};
    path[operation.method] = buildOperation(operation);
    paths[operation.path] = path;
  }

  return sortKeys({
    openapi: "3.1.0",
    info: {
      title: "027Apps Core API",
      version: CORE_VERSION,
      description:
        "The single data surface for the admin panel, the mobile app and third-party tools. " +
        "Generated from the same zod schemas that validate requests and responses.",
    },
    servers: [{ url: "/api/v1", description: "This instance" }],
    security: [{ sessionAuth: [] }, { apiKeyAuth: [] }],
    components: {
      securitySchemes: SECURITY_SCHEMES,
      schemas: components,
    },
    paths,
  }) as JsonObject;
}

/** Canonical serialization: sorted keys, 2 spaces and a final newline. */
export function serializeOpenApiDocument(document: JsonObject = buildOpenApiDocument()): string {
  return `${JSON.stringify(sortKeys(document), null, 2)}\n`;
}

let cachedJson: string | null = null;

/** The document as served by `GET /api/v1/openapi.json` (built once per process). */
export function openApiJson(): string {
  cachedJson ??= serializeOpenApiDocument();
  return cachedJson;
}

function main(): void {
  const check = process.argv.includes("--check");
  const generated = serializeOpenApiDocument();
  const target = fileURLToPath(DOCUMENT_PATH);

  if (check) {
    const current = existsSync(target) ? readFileSync(target, "utf8") : null;
    if (current !== generated) {
      process.stderr.write(
        "openapi: docs/api/openapi.json is out of date. Run `pnpm --filter @027apps/core openapi:generate`.\n",
      );
      process.exitCode = 1;
      return;
    }
    process.stdout.write("openapi: docs/api/openapi.json is up to date\n");
    return;
  }

  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, generated, "utf8");
  process.stdout.write("openapi: wrote docs/api/openapi.json\n");
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) main();
