import { openApiJson } from "@027apps/core/openapi/generate.js";

/** Never cache the route itself at build time; `openApiJson()` is cached in-process. */
export const dynamic = "force-dynamic";

/**
 * GET /api/v1/openapi.json — the contract itself is public: reading it needs
 * no session. The body is generated from the shared zod schemas once per
 * process, so it can never drift from the running API.
 */
export function GET(): Response {
  return new Response(openApiJson(), {
    status: 200,
    headers: {
      "content-type": "application/json",
      "cache-control": "public, max-age=300",
      "x-request-id": crypto.randomUUID(),
    },
  });
}
