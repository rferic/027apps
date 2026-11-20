"use server";

import { cookies, headers } from "next/headers";
import { z } from "zod";
import { DomainError } from "@027apps/core/errors.js";
import { redeemInvitation } from "@027apps/core/invitations/service.js";
import type { InvitationPreview } from "@027apps/core/invitations/service.js";
import type { Locale } from "@027apps/i18n/types.js";
import { getInfra } from "@/lib/api/door";
import { clientIp } from "@/lib/client-ip";
import { requestHost } from "@/lib/same-origin";
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
    // Anonymous invitation: the name and email the invitee filled in.
    name: z.string().trim().min(1).max(80).optional(),
    email: z.string().trim().email().max(320).optional(),
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


/** Same-origin check plus the per-IP budget, before any database work. */
function blocked(reason: string): SubmitInvitationResult {
  return { ok: false, code: reason };
}

async function requestBlocked(): Promise<SubmitInvitationResult | null> {
  const requestHeaders = await headers();
  const origin = requestHeaders.get("origin");
  const host = requestHost(requestHeaders);
  if (!origin || !host || originHost(origin) !== host) {
    return blocked("validation_failed");
  }

  const { deps } = await getInfra();
  const now = Date.now();
  const windowStart = new Date(Math.floor(now / 60_000) * 60_000);
  const { count } = await deps.rateLimitStorage.increment(
    `redeem-action:${clientIp(requestHeaders)}`,
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
  /** Anonymous invitation: the name/email the invitee filled in. */
  name?: string;
  email?: string;
  supabase: SupabaseServer;
  serviceDeps: ServiceDeps;
}

async function redeemExisting(ctx: RedeemContext): Promise<SubmitInvitationResult> {
  const { token, preview, password, supabase, serviceDeps } = ctx;
  // `redeemExisting` only runs when `account_exists` is true, which preview
  // only reports for a named invitation: the address is never null here.
  const { data, error } = await supabase.auth.signInWithPassword({
    email: preview.email!,
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
    { email: preview.email! },
    { kind: "session", userId: data.user.id, role },
  );
  if (redeemed.user.role === "user") {
    // A plain member has no panel pages: no panel cookie is left behind.
    await supabase.auth.signOut({ scope: "local" });
  }
  return { ok: true, role: redeemed.user.role, existingAccount: true };
}

/**
 * Signs in with the typed password and retries the redemption with the session.
 * D11: a wrong password on an existing account answers `existing_account` (not
 * a bare `wrong_credentials`), because the form the invitee filled in said
 * "choose a password". The invitation stays pending either way.
 */
async function redeemExistingSession(
  ctx: RedeemContext,
  accountEmail: string,
): Promise<SubmitInvitationResult> {
  const { token, password, supabase, serviceDeps } = ctx;
  const { data, error } = await supabase.auth.signInWithPassword({ email: accountEmail, password });
  if (error || !data.user) return blocked("existing_account");

  const role = await profileRole(serviceDeps, data.user.id);
  if (!role) {
    await supabase.auth.signOut({ scope: "local" });
    return blocked("conflict");
  }

  const redeemed = await redeemInvitation(
    serviceDeps,
    token,
    { email: accountEmail },
    { kind: "session", userId: data.user.id, role },
  );
  // The account is already signed in: a plain member signs out, a panel role
  // stays authenticated without a second sign-in.
  if (redeemed.user.role === "user") await supabase.auth.signOut({ scope: "local" });
  return { ok: true, role: redeemed.user.role, existingAccount: true };
}

/** Signs out a plain member, signs a panel role in; shared by every new flow. */
async function finishRedeemed(
  redeemed: Awaited<ReturnType<typeof redeemInvitation>>,
  ctx: RedeemContext,
  accountEmail: string,
): Promise<SubmitInvitationResult> {
  const { password, supabase } = ctx;
  const role = redeemed.user.role;
  if (role === "user") {
    await supabase.auth.signOut({ scope: "local" });
    return { ok: true, role };
  }
  const { error } = await supabase.auth.signInWithPassword({ email: accountEmail, password });
  return error ? { ok: true, role, signInFailed: true } : { ok: true, role };
}

/** New account: redeem with the chosen password, then sign in for a panel role. */
async function redeemNew(ctx: RedeemContext): Promise<SubmitInvitationResult> {
  const { token, preview, password, name, email, serviceDeps } = ctx;
  // An anonymous invitation takes the address from the form; a named one
  // carries it in the token (never null once the preview is named).
  const accountEmail = preview.requires_identity ? email! : preview.email!;

  let redeemed: Awaited<ReturnType<typeof redeemInvitation>>;
  try {
    redeemed = await redeemInvitation(
      serviceDeps,
      token,
      {
        email: accountEmail,
        ...(preview.requires_identity ? { name } : {}),
        password,
      },
      { kind: "anon" },
    );
  } catch (error) {
    // D11: an anonymous invitation redeemed with an email that already has an
    // account — sign in and retry with the session, so the user completes in
    // the browser instead of dead-ending. A wrong password leaves the
    // invitation pending and reports the usual error.
    if (
      preview.requires_identity &&
      error instanceof DomainError &&
      error.code === "existing_account_signin_required"
    ) {
      return redeemExistingSession(ctx, accountEmail);
    }
    throw error;
  }

  return finishRedeemed(redeemed, ctx, accountEmail);
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

/** An anonymous invitation needs the name and email the invitee typed. */
function anonymousIdentityValid(name: string | undefined, email: string | undefined): boolean {
  const trimmedName = (name ?? "").trim();
  return trimmedName.length > 0 && trimmedName.length <= 80 && Boolean(email);
}

/** Resolves a redeemable preview, or the blocked result to return immediately. */
async function redeemablePreview(
  token: string,
): Promise<{ preview: InvitationPreview } | { blocked: SubmitInvitationResult }> {
  const preview = await loadInvitePreview(token);
  if (!preview) return { blocked: blocked("not_found") };
  if (preview.state !== "pending") {
    return {
      blocked: blocked(preview.state === "used" ? "invitation_used" : "invitation_expired"),
    };
  }
  return { preview };
}

/** Server action behind the web form. The token never leaves the server logs. */
export async function submitInvitation(raw: unknown): Promise<SubmitInvitationResult> {
  const parsed = submitSchema.safeParse(raw);
  if (!parsed.success) return blocked("validation_failed");
  const { token, password, name, email } = parsed.data;

  const denied = await requestBlocked();
  if (denied) return denied;

  try {
    // Re-resolve the preview: the client's copy is a hint, never the truth.
    const resolved = await redeemablePreview(token);
    if ("blocked" in resolved) return resolved.blocked;
    const { preview } = resolved;

    // The server action is directly invocable: an anonymous invitation without
    // a name or email is a validation error, not a TypeError deeper in.
    if (preview.requires_identity && !anonymousIdentityValid(name, email)) {
      return blocked("validation_failed");
    }

    const supabase = await createSupabaseServerClient();
    const serviceDeps = await invitationServiceDeps();
    const context = { token, preview, password, name, email, supabase, serviceDeps };
    const result = preview.account_exists
      ? await redeemExisting(context)
      : await redeemNew(context);
    if (result.ok) await rememberLocale(preview.locale);
    return result;
  } catch (error) {
    return blocked(error instanceof DomainError ? error.code : "internal");
  }
}
