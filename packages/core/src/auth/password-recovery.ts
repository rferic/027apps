import { createHash } from "node:crypto";
import type { QueryClient } from "../api/rate-limit-storage";
import { isEmailLocale, type EmailLocale } from "../email/types";

/**
 * Password recovery (spec §7.6). The endpoint is deliberately uninformative:
 * an unknown address, a deactivated account, a rate-limited request and a
 * successful one all resolve the same, take at least the same time and never
 * say whether the account exists.
 */
export interface RecoveryRateLimiter {
  increment(
    key: string,
    windowStart: Date,
    expiresAt: Date,
  ): Promise<{ count: number }>;
}

/** Supabase Auth port: find the account and mint a recovery token. */
export interface PasswordRecoveryAuth {
  findUserByEmail(email: string): Promise<{ id: string } | null>;
  /** `generateLink({ type: "recovery" })`: only the hash leaves Supabase. */
  generateRecoveryLink(email: string): Promise<{ tokenHash: string }>;
}

export interface RecoveryMailer {
  send(input: {
    to: string;
    name: string;
    locale: EmailLocale;
    link: string;
    instanceName: string;
  }): Promise<{ status: "sent" | "failed" | "skipped"; code?: string }>;
}

export interface PasswordRecoveryDeps {
  db: QueryClient;
  auth: PasswordRecoveryAuth;
  mailer: RecoveryMailer;
  rateLimit: RecoveryRateLimiter;
  /** `instance.public_url`, without a trailing slash. */
  publicUrl: string;
  /** `instance.name`. */
  instanceName: string;
  now?: () => Date;
  /** Injectable for tests; production waits with a timer. */
  wait?: (ms: number) => Promise<void>;
  /** Common response floor; ~700 ms in production (S3). */
  floorMs?: number;
}

const IP_LIMIT = 5;
const EMAIL_LIMIT = 3;
const DEFAULT_FLOOR_MS = 700;
const HOUR_MS = 3_600_000;

const normalizeEmail = (value: string): string => value.trim().toLowerCase();
const hashEmail = (value: string): string =>
  createHash("sha256").update(value).digest("hex");

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** `{publicUrl}/auth/confirm` with the hash and the allowlisted next path. */
export function recoveryLink(publicUrl: string, tokenHash: string): string {
  const base = publicUrl.replace(/\/+$/, "");
  return `${base}/auth/confirm?token_hash=${encodeURIComponent(tokenHash)}&type=recovery&next=%2Freset-password`;
}

async function deliver(deps: PasswordRecoveryDeps, email: string): Promise<void> {
  const account = await deps.auth.findUserByEmail(email);
  if (!account) return;

  const { rows } = await deps.db.query(
    "select display_name, locale, deactivated_at from public.profiles where id = $1",
    [account.id],
  );
  const profile = rows[0];
  // A deactivated account must not receive a recovery link, but it is answered
  // exactly like an unknown one.
  if (!profile) return;
  if (profile.deactivated_at !== null && profile.deactivated_at !== undefined) return;

  const { tokenHash } = await deps.auth.generateRecoveryLink(email);
  const locale: EmailLocale = isEmailLocale(profile.locale) ? profile.locale : "en";
  const name =
    typeof profile.display_name === "string" && profile.display_name.length > 0
      ? profile.display_name
      : email;

  // A mailer failure is silent to the caller: reporting it would confirm the
  // address exists.
  await deps.mailer
    .send({
      to: email,
      name,
      locale,
      link: recoveryLink(deps.publicUrl, tokenHash),
      instanceName: deps.instanceName,
    })
    .catch(() => undefined);
}

/**
 * Always resolves. Applies both budgets, never sends for an unknown or
 * deactivated account and enforces the common response floor on every path.
 */
export async function requestPasswordReset(
  deps: PasswordRecoveryDeps,
  input: { email: string; ip: string },
): Promise<void> {
  const email = normalizeEmail(input.email);
  const now = deps.now?.() ?? new Date();
  const windowStart = new Date(Math.floor(now.getTime() / HOUR_MS) * HOUR_MS);
  const expiresAt = new Date(windowStart.getTime() + 2 * HOUR_MS);
  const started = Date.now();

  try {
    const [byIp, byEmail] = await Promise.all([
      deps.rateLimit.increment(`recovery:ip:${input.ip}`, windowStart, expiresAt),
      deps.rateLimit.increment(
        `recovery:email:${hashEmail(email)}`,
        windowStart,
        expiresAt,
      ),
    ]);
    if (byIp.count > IP_LIMIT || byEmail.count > EMAIL_LIMIT) return;
    await deliver(deps, email);
  } catch {
    // Recovery must not fail loudly: a 500 for an existing account would be an
    // enumeration oracle.
  } finally {
    const remaining = (deps.floorMs ?? DEFAULT_FLOOR_MS) - (Date.now() - started);
    if (remaining > 0) await (deps.wait ?? sleep)(remaining);
  }
}
