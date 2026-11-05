import { z } from "zod";
import { withDoor } from "../api/door";
import { DomainError } from "../errors";
import type { Caller, CorsOptions, DoorDeps } from "../api/types";
import { maintenanceStatus, runMaintenance, type MaintenanceDeps } from "./service";

/** Maintenance endpoints (core-api spec §3.10). Run needs a service key with
 * `role_cap=super_admin`; status is read by the super_admin session. */
export interface MaintenanceRouteDeps {
  door: DoorDeps;
  auth: (req: Request) => Promise<Caller>;
  maintenance: MaintenanceDeps;
  cors?: CorsOptions;
}

const runSchema = z.object({ jobs: z.array(z.string().min(1).max(64)).optional() }).strict().optional();

function assertInstanceKey(caller: Caller): void {
  if (caller.kind !== "service" || caller.roleCap !== "super_admin") {
    throw new DomainError("insufficient_scope");
  }
}

export function maintenanceRunRoute(deps: MaintenanceRouteDeps) {
  return (req: Request): Promise<Response> =>
    withDoor(
      req,
      {
        scopes: ["maintenance:run"],
        auth: deps.auth,
        cors: deps.cors,
        schema: runSchema,
        rateLimit: { identity: "key", limit: 5 },
      },
      deps.door,
      async (ctx) => {
        assertInstanceKey(ctx.caller);
        const body = (ctx.body ?? {}) as { jobs?: string[] };
        const results = await runMaintenance(deps.maintenance, ctx.caller, body.jobs);
        const allLeased = results.every(
          (result) => (result.summary as { reason?: string } | undefined)?.reason === "lease",
        );
        if (allLeased && results.length > 0) {
          throw new DomainError("conflict", "Maintenance is already running");
        }
        return { runs: results };
      },
    );
}

export function maintenanceStatusRoute(deps: MaintenanceRouteDeps) {
  return (req: Request): Promise<Response> =>
    withDoor(
      req,
      { scopes: [], auth: deps.auth, cors: deps.cors, rateLimit: { identity: "user", limit: 120 } },
      deps.door,
      async (ctx) => {
        if (ctx.caller.kind !== "session" || ctx.caller.role !== "super_admin") {
          throw new DomainError("insufficient_scope");
        }
        return maintenanceStatus(deps.maintenance);
      },
    );
}
