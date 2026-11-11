import {
  failureFrom,
  readMutation,
  withoutBody,
  type MutationFailure,
  type MutationResult,
} from "@/lib/mutation-result";

export interface CreateInvitationInput {
  email: string;
  name: string;
  user_category_id?: string;
  modules?: string[];
  expires_in_days?: number;
  locale?: string;
  delivery?: "email" | "link";
}

/** Result of handing the invitation to Resend. */
export interface InvitationDelivery {
  status: "sent" | "failed" | "skipped";
  code?: string;
}

export type CreateInvitationResult =
  | { ok: true; token?: string; invitationId?: string; email?: InvitationDelivery }
  | MutationFailure;

/** A reissued token, plus the email outcome when the action sends one. */
export type InvitationActionResult =
  | { ok: true; token: string; email?: InvitationDelivery }
  | MutationFailure;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

async function bodyOrFailure(res: Response): Promise<MutationFailure> {
  const headerRequestId = res.headers.get("x-request-id") ?? undefined;
  try {
    return failureFrom(JSON.parse(await res.text()), headerRequestId);
  } catch {
    return withoutBody(headerRequestId);
  }
}

function requestBody(input: CreateInvitationInput): Record<string, unknown> {
  const body: Record<string, unknown> = { email: input.email, name: input.name };
  if (input.user_category_id) body.user_category_id = input.user_category_id;
  if (input.modules && input.modules.length > 0) body.modules = input.modules;
  if (input.expires_in_days !== undefined) body.expires_in_days = input.expires_in_days;
  if (input.locale) body.locale = input.locale;
  if (input.delivery) body.delivery = input.delivery;
  return body;
}

function readDelivery(value: unknown): InvitationDelivery | undefined {
  if (!isRecord(value)) return undefined;
  if (value.status !== "sent" && value.status !== "failed" && value.status !== "skipped") {
    return undefined;
  }
  const code = readString(value.code);
  return { status: value.status, ...(code ? { code } : {}) };
}

function createdResult(parsed: unknown, headerRequestId: string | undefined): CreateInvitationResult {
  if (!isRecord(parsed)) return withoutBody(headerRequestId);
  const token = readString(parsed.token);
  const invitation = isRecord(parsed.invitation) ? parsed.invitation : {};
  const invitationId = readString(invitation.id);
  const email = readDelivery(parsed.email);
  return {
    ok: true,
    ...(token ? { token } : {}),
    ...(invitationId ? { invitationId } : {}),
    ...(email ? { email } : {}),
  };
}

/** Full invitation link from the instance's public URL; the token alone if unset. */
export function invitationLink(token: string, publicUrl: string | null): string {
  return publicUrl
    ? `${publicUrl.replace(/\/+$/, "")}/invite/${encodeURIComponent(token)}`
    : token;
}

async function postAction(
  path: string,
  fetcher: typeof fetch,
): Promise<InvitationActionResult> {
  let res: Response;
  try {
    res = await fetcher(path, { method: "POST", credentials: "same-origin" });
  } catch {
    return { ok: false };
  }

  if (!res.ok) return bodyOrFailure(res);

  const headerRequestId = res.headers.get("x-request-id") ?? undefined;
  try {
    const parsed: unknown = JSON.parse(await res.text());
    if (!isRecord(parsed)) return withoutBody(headerRequestId);
    const token = readString(parsed.token);
    if (!token) return withoutBody(headerRequestId);
    const email = readDelivery(parsed.email);
    return { ok: true, token, ...(email ? { email } : {}) };
  } catch {
    return withoutBody(headerRequestId);
  }
}

/**
 * The Core returns the plaintext token exactly once, in the creation response.
 * The panel keeps it in client state only: never a URL, a cookie or a log.
 */
export async function createInvitation(
  input: CreateInvitationInput,
  fetcher: typeof fetch = fetch,
): Promise<CreateInvitationResult> {
  let res: Response;
  try {
    res = await fetcher("/api/v1/invitations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(requestBody(input)),
    });
  } catch {
    return { ok: false };
  }

  if (!res.ok) return bodyOrFailure(res);
  if (res.status === 204) return { ok: true };

  const headerRequestId = res.headers.get("x-request-id") ?? undefined;
  try {
    return createdResult(JSON.parse(await res.text()), headerRequestId);
  } catch {
    return withoutBody(headerRequestId);
  }
}

export async function revokeInvitation(
  id: string,
  fetcher: typeof fetch = fetch,
): Promise<MutationResult> {
  let res: Response;
  try {
    res = await fetcher(`/api/v1/invitations/${encodeURIComponent(id)}`, {
      method: "DELETE",
      credentials: "same-origin",
    });
  } catch {
    return { ok: false };
  }
  return readMutation(res);
}

/** Reissues the token and sends it again; only pending invitations. */
export function resendInvitationEmail(
  id: string,
  fetcher: typeof fetch = fetch,
): Promise<InvitationActionResult> {
  return postAction(`/api/v1/invitations/${encodeURIComponent(id)}/resend-email`, fetcher);
}

/** Reissues the token without sending it, for the manual copy fallback. */
export function regenerateInvitationLink(
  id: string,
  fetcher: typeof fetch = fetch,
): Promise<InvitationActionResult> {
  return postAction(`/api/v1/invitations/${encodeURIComponent(id)}/link`, fetcher);
}
