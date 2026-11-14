import { withDoor } from "../api/door";
import { DEFAULT_READ_LIMIT, DEFAULT_WRITE_LIMIT } from "../api/rate-limits";
import type { Caller, CorsOptions, DoorDeps } from "../api/types";
import { clearDemo, demoStatus, seedDemo, type DemoDeps } from "./service";

/**
 * Demo data API (D21). Administrators seed and clear the sample dataset; the
 * production gate lives in the service, so the routes only enforce the scope.
 */
export interface DemoRouteDeps {
  door: DoorDeps;
  auth: (req: Request) => Promise<Caller>;
  demo: DemoDeps;
  cors?: CorsOptions;
  rateLimits?: { read?: number; write?: number };
}

function readOptions(deps: DemoRouteDeps) {
  return {
    scopes: ["settings:read"],
    auth: deps.auth,
    cors: deps.cors,
    rateLimit: { identity: "user" as const, limit: deps.rateLimits?.read ?? DEFAULT_READ_LIMIT },
  };
}

function writeOptions(deps: DemoRouteDeps) {
  return {
    scopes: ["settings:write"],
    auth: deps.auth,
    cors: deps.cors,
    rateLimit: { identity: "user" as const, limit: deps.rateLimits?.write ?? DEFAULT_WRITE_LIMIT },
  };
}

/** GET /api/v1/demo — whether the dataset exists and what each module seeded. */
export function demoStatusRoute(deps: DemoRouteDeps) {
  return (req: Request): Promise<Response> =>
    withDoor(req, readOptions(deps), deps.door, async () => ({
      demo: await demoStatus(deps.demo),
    }));
}

/** POST /api/v1/demo — idempotent seed of the demo dataset. */
export function demoSeedRoute(deps: DemoRouteDeps) {
  return (req: Request): Promise<Response> =>
    withDoor(req, writeOptions(deps), deps.door, async () => ({
      demo: await seedDemo(deps.demo),
    }));
}

/** DELETE /api/v1/demo — clear the dataset; refuses while a module holds it. */
export function demoClearRoute(deps: DemoRouteDeps) {
  return (req: Request): Promise<Response> =>
    withDoor(req, writeOptions(deps), deps.door, async () => ({
      demo: await clearDemo(deps.demo),
    }));
}
