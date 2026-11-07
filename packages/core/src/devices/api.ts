import { z } from "zod";
import { withDoor } from "../api/door";
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
    rateLimit: { identity: "user" as const, limit: deps.rateLimits?.write ?? 10 },
  };
}

function readOptions(deps: DevicesRouteDeps) {
  return {
    scopes: ["devices:read"],
    auth: deps.auth,
    cors: deps.cors,
    rateLimit: { identity: "user" as const, limit: deps.rateLimits?.read ?? 120 },
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
      await revokeDevice(deps.devices, ctx.caller, uuid(rawId));
      return new Response(null, { status: 204 });
    });
}
