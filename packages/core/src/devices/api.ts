import { z } from "zod";
import { withDoor } from "../api/door";
import { DEFAULT_READ_LIMIT, DEFAULT_WRITE_LIMIT } from "../api/rate-limits";
import { DomainError } from "../errors";
import type { Caller, CorsOptions, DoorDeps } from "../api/types";
import { listDevices, registerDevice, revokeDevice, type DevicesDeps } from "./service";

/**
 * Devices (core-api spec §3.7): the owner registers/list devices; admins may
 * list another user's devices from the panel and revoke them.
 */
export interface DevicesRouteDeps {
  door: DoorDeps;
  auth: (req: Request) => Promise<Caller>;
  devices: DevicesDeps;
  cors?: CorsOptions;
  rateLimits?: { read?: number; write?: number };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const registerDeviceSchema = z
  .object({
    platform: z.enum(["android", "ios"]),
    push_token: z.string().trim().min(8).max(4096).optional().nullable(),
  })
  .strict();

/**
 * `local` is the owner's own logout: it unregisters the push device and leaves
 * the web/other phones signed in. `all` (the default, used by the panel)
 * revokes every session. An admin revoking another user's device always gets
 * `all`; the service enforces that even if the query says `local`.
 */
export const revokeDeviceQuerySchema = z
  .object({
    sessions: z.enum(["all", "local"]).optional(),
  })
  .strict();

function uuid(value: string): string {
  if (!UUID.test(value)) throw new DomainError("validation_failed", "invalid id");
  return value;
}

function options(deps: DevicesRouteDeps, scopes: string[], schema?: z.ZodType) {
  return {
    scopes,
    auth: deps.auth,
    cors: deps.cors,
    ...(schema ? { schema } : {}),
    rateLimit: { identity: "user" as const, limit: deps.rateLimits?.write ?? DEFAULT_WRITE_LIMIT },
  };
}

function readOptions(deps: DevicesRouteDeps) {
  return {
    scopes: ["devices:read"],
    auth: deps.auth,
    cors: deps.cors,
    rateLimit: { identity: "user" as const, limit: deps.rateLimits?.read ?? DEFAULT_READ_LIMIT },
  };
}

export function devicesRoute(deps: DevicesRouteDeps) {
  return (req: Request): Promise<Response> =>
    withDoor(req, readOptions(deps), deps.door, async (ctx) => {
      const user = ctx.searchParams.get("user");
      return {
        devices: await listDevices(deps.devices, ctx.caller, user ? { user_id: uuid(user) } : {}),
      };
    });
}

export function registerDeviceRoute(deps: DevicesRouteDeps) {
  return (req: Request): Promise<Response> =>
    withDoor(
      req,
      options(deps, ["devices:write"], registerDeviceSchema),
      deps.door,
      async (ctx) => ({
        device: await registerDevice(
          deps.devices,
          ctx.caller,
          ctx.body as { platform: "android" | "ios"; push_token?: string | null },
        ),
      }),
    );
}

export function revokeDeviceRoute(deps: DevicesRouteDeps) {
  return (req: Request, rawId: string): Promise<Response> =>
    withDoor(req, options(deps, ["devices:revoke"]), deps.door, async (ctx) => {
      const parsed = revokeDeviceQuerySchema.safeParse({
        sessions: ctx.searchParams.get("sessions") || undefined,
      });
      if (!parsed.success) {
        throw new DomainError("validation_failed", "invalid sessions");
      }
      await revokeDevice(deps.devices, ctx.caller, uuid(rawId), {
        revokeSessions: parsed.data.sessions !== "local",
      });
      return new Response(null, { status: 204 });
    });
}
