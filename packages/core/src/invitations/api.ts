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
  previewInvitation,
  recordEmailAttempt,
  redeemInvitation,
  renewInvitation,
  resendCooldownSeconds,
  revokeInvitation,
  rotateInvitationToken,
  type InvitationsDeps,
  type InvitationView,
  type RedeemInput,
} from "./service";
import { EMAIL_LOCALES, type EmailLocale } from "../email/types";
import {
  createMemberInvitation,
  listOwnInvitations,
  revokeOwnInvitation,
} from "./member";
import {
  createJoinCode,
  exchangeJoinCode,
  previewJoinCode,
} from "./join-codes";

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
  sendInvitation(input: {
    invitation: InvitationView;
    token: string;
    /** The email already belongs to a profile: send the "sign in" variant. */
    accountExists: boolean;
  }): Promise<InvitationDelivery>;
}

export interface InvitationsRouteDeps {
  door: DoorDeps;
  auth: (req: Request) => Promise<Caller>;
  invitations: InvitationsDeps;
  mailer?: InvitationsMailer;
  cors?: CorsOptions;
  rateLimits?: {
    read?: number;
    write?: number;
    redeem?: number;
    preview?: number;
    memberInvite?: number;
    joinCodeCreate?: number;
    joinCodePreview?: number;
    joinCodeExchange?: number;
  };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const createInvitationSchema = z
  .object({
    email: z.string().trim().email().max(320),
    name: z.string().trim().min(1).max(80),
    role: z.enum(["user", "admin"]).optional(),
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
    /** A new account needs it; an existing one signs in first and omits it. */
    password: z.string().min(12).max(200).optional(),
    display_name: z.string().trim().min(1).max(80).optional(),
  })
  .strict();

/** `POST /me/invitations` body: empty, the server derives every field. */
export const createMemberInvitationSchema = z.object({}).strict();

function uuid(value: string, field: string): string {
  if (!UUID.test(value)) throw new DomainError("validation_failed", `invalid ${field}`);
  return value;
}

/**
 * Responses that carry an invitation token or invitee PII must not be stored,
 * indexed or leaked through the Referer (spec §6.1). The door clones the
 * Response and adds the request id, so these headers survive.
 */
const TOKEN_RESPONSE_HEADERS: Record<string, string> = {
  "content-type": "application/json",
  "cache-control": "no-store",
  "x-robots-tag": "noindex, nofollow",
  "referrer-policy": "no-referrer",
};

function tokenResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: TOKEN_RESPONSE_HEADERS });
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
  // Anonymous invitations have no address: the link is shared, never emailed.
  if (!invitation.email) return { status: "skipped", code: "email_no_recipient" };

  // The email copy is different when the address already has an account (D16).
  const accountExists = (await deps.invitations.auth.findUserByEmail(invitation.email)) !== null;
  const result = await deps.mailer.sendInvitation({ invitation, token, accountExists });
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
          role?: "user" | "admin";
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

/**
 * Public preview by token. Anonymous by design: the token is the only
 * credential, it is validated at the edge and a revoked/unknown one is a 404.
 */
export function invitationPreviewRoute(deps: InvitationsRouteDeps) {
  return (req: Request, rawToken: string): Promise<Response> =>
    withDoor(
      req,
      {
        scopes: [],
        auth: async () => ({ kind: "anon" as const }),
        cors: deps.cors,
        rateLimit: { identity: "ip" as const, limit: deps.rateLimits?.preview ?? 60 },
      },
      deps.door,
      async () => tokenResponse({ invitation: await previewInvitation(deps.invitations, rawToken) }),
    );
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

/** Renews an expired invitation: rotates the token and sends the email again. */
export function renewInvitationRoute(deps: InvitationsRouteDeps) {
  return (req: Request, rawId: string): Promise<Response> =>
    withDoor(req, options(deps, ["invitations:write"]), deps.door, async () => {
      const id = uuid(rawId, "invitation id");
      const current = await getInvitation(deps.invitations, id);
      // Check the cooldown before rotating: a 429 must not kill the old link.
      const wait = resendCooldownSeconds(current, new Date());
      if (wait > 0) {
        throw new DomainError("rate_limited", "Wait before renewing this invitation", {
          retry_after: wait,
        });
      }
      const renewed = await renewInvitation(deps.invitations, id);
      const email = await deliver(deps, renewed.invitation, renewed.token, "email");
      return { invitation: renewed.invitation, token: renewed.token, email };
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
        // The real resolver, not a fixed `anon`: an anonymous caller redeems a
        // new account, while an existing one must present its own session (D21).
        auth: deps.auth,
        cors: deps.cors,
        schema: redeemInvitationSchema,
        rateLimit: { identity: "ip" as const, limit: deps.rateLimits?.redeem ?? 30 },
      },
      deps.door,
      async (ctx: RequestContext) =>
        tokenResponse(
          await redeemInvitation(deps.invitations, token, ctx.body as RedeemInput, ctx.caller),
          201,
        ),
    );
}

/**
 * `GET /me/invitations` — the caller's quota, their own invitations (never the
 * tokens) and their direct invitees. Session-only, any role.
 */
export function memberInvitationsRoute(deps: InvitationsRouteDeps) {
  return (req: Request): Promise<Response> =>
    withDoor(
      req,
      {
        scopes: ["profile:read"],
        auth: deps.auth,
        cors: deps.cors,
        rateLimit: { identity: "user" as const, limit: deps.rateLimits?.read ?? DEFAULT_READ_LIMIT },
      },
      deps.door,
      async (ctx) => listOwnInvitations(deps.invitations, ctx.caller),
    );
}

/** `POST /me/invitations` — mint a 48-hour anonymous member invitation. */
export function createMemberInvitationRoute(deps: InvitationsRouteDeps) {
  return (req: Request): Promise<Response> =>
    withDoor(
      req,
      {
        scopes: ["profile:write"],
        auth: deps.auth,
        cors: deps.cors,
        schema: createMemberInvitationSchema,
        rateLimit: { identity: "user" as const, limit: deps.rateLimits?.memberInvite ?? 10 },
      },
      deps.door,
      async (ctx) => tokenResponse(await createMemberInvitation(deps.invitations, ctx.caller), 201),
    );
}

/** `DELETE /me/invitations/{id}` — revoke one of the caller's own invitations. */
export function revokeMemberInvitationRoute(deps: InvitationsRouteDeps) {
  return (req: Request, rawId: string): Promise<Response> =>
    withDoor(
      req,
      {
        scopes: ["profile:write"],
        auth: deps.auth,
        cors: deps.cors,
        rateLimit: { identity: "user" as const, limit: deps.rateLimits?.write ?? DEFAULT_WRITE_LIMIT },
      },
      deps.door,
      async (ctx) => {
        await revokeOwnInvitation(deps.invitations, ctx.caller, uuid(rawId, "invitation id"));
        return new Response(null, { status: 204 });
      },
    );
}

/** `POST /me/join-codes` — mint a 90-second QR join code; returned once. */
export function createJoinCodeRoute(deps: InvitationsRouteDeps) {
  return (req: Request): Promise<Response> =>
    withDoor(
      req,
      {
        scopes: ["profile:write"],
        auth: deps.auth,
        cors: deps.cors,
        rateLimit: { identity: "user" as const, limit: deps.rateLimits?.joinCodeCreate ?? 6 },
      },
      deps.door,
      async (ctx) => tokenResponse(await createJoinCode(deps.invitations, ctx.caller), 201),
    );
}

/** `GET /join-codes/{code}/preview` — public preview that never mutates. */
export function joinCodePreviewRoute(deps: InvitationsRouteDeps) {
  return (req: Request, rawCode: string): Promise<Response> =>
    withDoor(
      req,
      {
        scopes: [],
        auth: async () => ({ kind: "anon" as const }),
        cors: deps.cors,
        rateLimit: { identity: "ip" as const, limit: deps.rateLimits?.joinCodePreview ?? 60 },
      },
      deps.door,
      async () => tokenResponse({ join: await previewJoinCode(deps.invitations, rawCode) }),
    );
}

/** `POST /join-codes/{code}/exchange` — single-use exchange for a 15-min invitation. */
export function joinCodeExchangeRoute(deps: InvitationsRouteDeps) {
  return (req: Request, rawCode: string): Promise<Response> =>
    withDoor(
      req,
      {
        scopes: [],
        auth: async () => ({ kind: "anon" as const }),
        cors: deps.cors,
        rateLimit: { identity: "ip" as const, limit: deps.rateLimits?.joinCodeExchange ?? 10 },
      },
      deps.door,
      async () => tokenResponse(await exchangeJoinCode(deps.invitations, rawCode), 201),
    );
}
