"use server";

import { cookies, headers } from "next/headers";
import { z } from "zod";
import { DomainError } from "@027apps/core/errors.js";
import { redeemInvitation } from "@027apps/core/invitations/service.js";
import type { InvitationPreview } from "@027apps/core/invitations/service.js";
import type { Locale } from "@027apps/i18n/types.js";
import { getInfra } from "@/lib/api/door";
import { invitationServiceDeps } from "@/lib/invitation-service-deps";
import type { SubmitInvitationResult } from "@/lib/invite-action-types";
import { loadInvitePreview } from "@/lib/invite-preview";
import { LOCALE_COOKIE } from "@/lib/locale";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const ACTION_LIMIT = 30;
const submitSchema = z
  .object({
    token: z.string().min(1).max(200),
    password: z.string().min(1).max(200),
  })
  .strict();

type SupabaseServer = Awaited<ReturnType<typeof createSupabaseServerClient>>;
type ServiceDeps = Awaited<ReturnType<typeof invitationServiceDeps>>;
type ProfileRole = "user" | "admin" | "super_admin";
const PROFILE_ROLES: readonly ProfileRole[] = ["user", "admin", "super_admin"];

/** `URL.host` without throwing on a malformed Origin header. */
function originHost(value: string): string | null {
  try {
    return new URL(value).host;
  } catch {
    return null;
  }
}

function requestIp(requestHeaders: Headers): string {
  return (
    requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    requestHeaders.get("x-real-ip") ||
    "unknown"
  );
}

/** Same-origin check plus the per-IP budget, before any database work. */
function blocked(reason: string): SubmitInvitationResult {
  return { ok: false, code: reason };
}

async function requestBlocked(): Promise<SubmitInvitationResult | null> {
  const requestHeaders = await headers();
  const origin = requestHeaders.get("origin");
  const host = requestHeaders.get("host");
  if (!origin || !host || originHost(origin) !== host) {
    return blocked("validation_failed");
  }

  const { deps } = await getInfra();
  const now = Date.now();
  const windowStart = new Date(Math.floor(now / 60_000) * 60_000);
  const { count } = await deps.rateLimitStorage.increment(
    `redeem-action:${requestIp(requestHeaders)}`,
    windowStart,
    new Date(windowStart.getTime() + 120_000),
  );
  return count > ACTION_LIMIT ? blocked("rate_limited") : null;
}

async function profileRole(serviceDeps: ServiceDeps, userId: string): Promise<ProfileRole | null> {
  const { rows } = await serviceDeps.db.query(
    "select role from public.profiles where id = $1 and deactivated_at is null",
    [userId],
  );
  const role = rows[0]?.role as ProfileRole | undefined;
  return role && PROFILE_ROLES.includes(role) ? role : null;
}

/**
 * Existing account (D21): sign in with its current password first. A wrong
 * password never reaches the redemption and never consumes the invitation.
 */
interface RedeemContext {
  token: string;
  preview: InvitationPreview;
  password: string;
  supabase: SupabaseServer;
  serviceDeps: ServiceDeps;
}

async function redeemExisting(ctx: RedeemContext): Promise<SubmitInvitationResult> {
  const { token, preview, password, supabase, serviceDeps } = ctx;
  const { data, error } = await supabase.auth.signInWithPassword({
    email: preview.email,
    password,
  });
  if (error || !data.user) return blocked("wrong_credentials");

  const role = await profileRole(serviceDeps, data.user.id);
  if (!role) {
    await supabase.auth.signOut({ scope: "local" });
    return blocked("conflict");
  }

  const redeemed = await redeemInvitation(
    serviceDeps,
    token,
    { email: preview.email },
    { kind: "session", userId: data.user.id, role },
  );
  if (redeemed.user.role === "user") {
    // A plain member has no panel pages: no panel cookie is left behind.
    await supabase.auth.signOut({ scope: "local" });
  }
  return { ok: true, role: redeemed.user.role };
}

/** New account: redeem with the chosen password, then sign in for a panel role. */
async function redeemNew(ctx: RedeemContext): Promise<SubmitInvitationResult> {
  const { token, preview, password, supabase, serviceDeps } = ctx;
  const redeemed = await redeemInvitation(
    serviceDeps,
    token,
    { email: preview.email, password },
    { kind: "anon" },
  );
  const role = redeemed.user.role;
  if (role === "user") {
    await supabase.auth.signOut({ scope: "local" });
    return { ok: true, role };
  }

  const { error } = await supabase.auth.signInWithPassword({
    email: preview.email,
    password,
  });
  // The account exists either way: a failed sign-in is a welcome notice, not a
  // second redemption attempt.
  return error ? { ok: true, role, signInFailed: true } : { ok: true, role };
}

/** Keeps the invitation's language for `/welcome` and the panel after accepting. */
async function rememberLocale(locale: Locale): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(LOCALE_COOKIE, locale, {
    path: "/",
    sameSite: "lax",
    maxAge: 31_536_000,
    secure: process.env.NODE_ENV === "production",
  });
}

/** Server action behind the web form. The token never leaves the server logs. */
export async function submitInvitation(raw: unknown): Promise<SubmitInvitationResult> {
  const parsed = submitSchema.safeParse(raw);
  if (!parsed.success) return blocked("validation_failed");
  const { token, password } = parsed.data;

  const denied = await requestBlocked();
  if (denied) return denied;

  try {
    // Re-resolve the preview: the client's copy is a hint, never the truth.
    const preview = await loadInvitePreview(token);
    if (!preview) return blocked("not_found");
    if (preview.state !== "pending") {
      return blocked(preview.state === "used" ? "invitation_used" : "invitation_expired");
    }

    const supabase = await createSupabaseServerClient();
    const serviceDeps = await invitationServiceDeps();
    const context = { token, preview, password, supabase, serviceDeps };
    const result = preview.account_exists
      ? await redeemExisting(context)
      : await redeemNew(context);
    if (result.ok) await rememberLocale(preview.locale);
    return result;
  } catch (error) {
    return blocked(error instanceof DomainError ? error.code : "internal");
  }
}
