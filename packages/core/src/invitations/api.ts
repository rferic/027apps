import { z } from "zod";
import { withDoor } from "../api/door";
import { pageParams } from "../api/pagination";
import { DEFAULT_READ_LIMIT, DEFAULT_WRITE_LIMIT } from "../api/rate-limits";
import { DomainError } from "../errors";
import type { Caller, CorsOptions, DoorDeps, RequestContext } from "../api/types";
import {
  createInvitation,
  getInvitation,
  listInvitations,
  redeemInvitation,
  revokeInvitation,
  type InvitationsDeps,
  type RedeemInput,
} from "./service";

/**
 * Invitations API (core-api spec §3.5). Admin routes require
 * `invitations:read|write`; redemption is public with its own per-IP budget.
 * The token is returned exactly once (creation) and never in list responses.
 */
export interface InvitationsRouteDeps {
  door: DoorDeps;
  auth: (req: Request) => Promise<Caller>;
  invitations: InvitationsDeps;
  cors?: CorsOptions;
  rateLimits?: { read?: number; write?: number; redeem?: number };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const createInvitationSchema = z
  .object({
    email: z.string().trim().email().max(320),
    name: z.string().trim().min(1).max(80),
    user_category_id: z.string().uuid().optional().nullable(),
    modules: z.array(z.string()).max(100).optional(),
    expires_in_days: z.number().int().min(1).max(365).optional(),
  })
  .strict();

/**
 * `GET /invitations` status filter. Validated at the edge like every other
 * filter: an unknown value is a 400 instead of a silently unfiltered list.
 * `all` is the explicit opt-out; omitting it also means `all`.
 */
export const invitationListFiltersSchema = z
  .object({
    status: z.enum(["pending", "used", "expired", "revoked", "all"]).optional(),
  })
  .strict();

export const redeemInvitationSchema = z
  .object({
    email: z.string().trim().email().max(320),
    password: z.string().min(12).max(200),
    display_name: z.string().trim().min(1).max(80).optional(),
  })
  .strict();

function uuid(value: string, field: string): string {
  if (!UUID.test(value)) throw new DomainError("validation_failed", `invalid ${field}`);
  return value;
}

function options(deps: InvitationsRouteDeps, scopes: string[], schema?: z.ZodType) {
  return {
    scopes,
    auth: deps.auth,
    cors: deps.cors,
    ...(schema ? { schema } : {}),
    rateLimit: { identity: "user" as const, limit: deps.rateLimits?.write ?? DEFAULT_WRITE_LIMIT },
  };
}

function readOptions(deps: InvitationsRouteDeps) {
  return {
    scopes: ["invitations:read"],
    auth: deps.auth,
    cors: deps.cors,
    rateLimit: { identity: "user" as const, limit: deps.rateLimits?.read ?? DEFAULT_READ_LIMIT },
  };
}

export function invitationsRoute(deps: InvitationsRouteDeps) {
  return (req: Request): Promise<Response> =>
    withDoor(req, readOptions(deps), deps.door, async (ctx) => {
      const page = pageParams(ctx.searchParams);
      const rawStatus = ctx.searchParams.get("status") || undefined;
      const filters = invitationListFiltersSchema.safeParse({ status: rawStatus });
      if (!filters.success) {
        throw new DomainError("validation_failed", "invalid status filter");
      }
      const result = await listInvitations(deps.invitations, {
        ...page,
        ...(filters.data.status ? { status: filters.data.status } : {}),
      });
      return { ...result, limit: page.limit, offset: page.offset };
    });
}

export function createInvitationRoute(deps: InvitationsRouteDeps) {
  return (req: Request): Promise<Response> =>
    withDoor(
      req,
      options(deps, ["invitations:write"], createInvitationSchema),
      deps.door,
      async (ctx) => ({
        status: 201,
        body: await createInvitation(
          deps.invitations,
          ctx.caller,
          ctx.body as {
            email: string;
            name: string;
            user_category_id?: string | null;
            modules?: string[];
            expires_in_days?: number;
          },
        ),
      }),
    );
}

export function invitationRoute(deps: InvitationsRouteDeps) {
  return (req: Request, rawId: string): Promise<Response> =>
    withDoor(req, readOptions(deps), deps.door, async () => ({
      invitation: await getInvitation(deps.invitations, uuid(rawId, "invitation id")),
    }));
}

export function revokeInvitationRoute(deps: InvitationsRouteDeps) {
  return (req: Request, rawId: string): Promise<Response> =>
    withDoor(req, options(deps, ["invitations:write"]), deps.door, async () => {
      await revokeInvitation(deps.invitations, uuid(rawId, "invitation id"));
      return new Response(null, { status: 204 });
    });
}

export function redeemInvitationRoute(deps: InvitationsRouteDeps) {
  return (req: Request, token: string): Promise<Response> =>
    withDoor(
      req,
      {
        scopes: [],
        auth: async () => ({ kind: "anon" as const }),
        cors: deps.cors,
        schema: redeemInvitationSchema,
        rateLimit: { identity: "ip" as const, limit: deps.rateLimits?.redeem ?? 30 },
      },
      deps.door,
      async (ctx: RequestContext) => ({
        status: 201,
        body: await redeemInvitation(
          deps.invitations,
          token,
          ctx.body as RedeemInput,
        ),
      }),
    );
}
