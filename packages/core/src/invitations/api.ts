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
  recordEmailAttempt,
  redeemInvitation,
  resendCooldownSeconds,
  revokeInvitation,
  rotateInvitationToken,
  type InvitationsDeps,
  type InvitationView,
  type RedeemInput,
} from "./service";
import { EMAIL_LOCALES, type EmailLocale } from "../email/types";

/**
 * Invitations API (core-api spec §3.5). Admin routes require
 * `invitations:read|write`; redemption is public with its own per-IP budget.
 * The token is returned exactly once (creation) and never in list responses.
 */
/** Outcome of handing the invitation to the email provider. */
export type InvitationDelivery = {
  status: "sent" | "failed" | "skipped";
  code?: string;
};

/** Email port; the admin adapter owns Resend and the instance settings. */
export interface InvitationsMailer {
  sendInvitation(input: { invitation: InvitationView; token: string }): Promise<InvitationDelivery>;
}

export interface InvitationsRouteDeps {
  door: DoorDeps;
  auth: (req: Request) => Promise<Caller>;
  invitations: InvitationsDeps;
  mailer?: InvitationsMailer;
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
    locale: z.enum(EMAIL_LOCALES).optional(),
    delivery: z.enum(["email", "link"]).optional(),
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

/** Sends the email when asked and records the attempt; never throws on failure. */
async function deliver(
  deps: InvitationsRouteDeps,
  invitation: InvitationView,
  token: string,
  mode: "email" | "link",
): Promise<InvitationDelivery> {
  if (mode === "link") return { status: "skipped" };
  if (!deps.mailer) return { status: "skipped", code: "not_configured" };

  const result = await deps.mailer.sendInvitation({ invitation, token });
  if (result.status !== "skipped") {
    await recordEmailAttempt(deps.invitations, invitation.id, {
      status: result.status,
      ...(result.code ? { code: result.code } : {}),
    });
  }
  return result;
}

export function createInvitationRoute(deps: InvitationsRouteDeps) {
  return (req: Request): Promise<Response> =>
    withDoor(
      req,
      options(deps, ["invitations:write"], createInvitationSchema),
      deps.door,
      async (ctx) => {
        const input = ctx.body as {
          email: string;
          name: string;
          user_category_id?: string | null;
          modules?: string[];
          expires_in_days?: number;
          locale?: EmailLocale;
          delivery?: "email" | "link";
        };
        const created = await createInvitation(deps.invitations, ctx.caller, input);
        const email = await deliver(deps, created.invitation, created.token, input.delivery ?? "email");
        return { status: 201, body: { ...created, email } };
      },
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

/** Reissues the token and sends it again; only for pending invitations. */
export function resendInvitationRoute(deps: InvitationsRouteDeps) {
  return (req: Request, rawId: string): Promise<Response> =>
    withDoor(req, options(deps, ["invitations:write"]), deps.door, async () => {
      const id = uuid(rawId, "invitation id");
      const current = await getInvitation(deps.invitations, id);
      const wait = resendCooldownSeconds(current, new Date());
      if (wait > 0) {
        throw new DomainError("rate_limited", "Wait before resending this invitation", {
          retry_after: wait,
        });
      }
      const rotated = await rotateInvitationToken(deps.invitations, id);
      const email = await deliver(deps, rotated.invitation, rotated.token, "email");
      return { token: rotated.token, email };
    });
}

/** Reissues the token without sending it, for the manual copy fallback. */
export function invitationLinkRoute(deps: InvitationsRouteDeps) {
  return (req: Request, rawId: string): Promise<Response> =>
    withDoor(req, options(deps, ["invitations:write"]), deps.door, async () => {
      const rotated = await rotateInvitationToken(
        deps.invitations,
        uuid(rawId, "invitation id"),
      );
      return { token: rotated.token, invitation: rotated.invitation };
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
