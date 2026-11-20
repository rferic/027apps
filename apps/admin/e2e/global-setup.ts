import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Client } from "pg";

/**
 * Prepares the accounts and invitations every spec needs, against the local
 * stack the panel is talking to.
 *
 * Nothing is hardcoded and nothing survives: the QA accounts are deleted before
 * and after the run, and the invitations are minted through the real API with a
 * real session, so the fixtures cannot drift from the product.
 */

const ROOT = join(__dirname, "..");
const FIXTURES = join(__dirname, ".fixtures.json");

const ADMIN = { email: "qa-e2e-admin@test.local", password: "qa-e2e-admin-password" };
const EXISTING = { email: "qa-e2e-existing@test.local", password: "qa-e2e-member-password" };

export interface Fixtures {
  admin: { email: string; password: string; id: string; name: string };
  existing: { email: string; password: string; id: string; name: string };
  invitee: { email: string; name: string; password: string };
  /** One anonymous invitation per scenario, minted by the admin. */
  tokens: { newAccount: string; existingAccount: string };
  baseURL: string;
}

function loadEnv(): void {
  try {
    process.loadEnvFile(join(ROOT, ".env.local"));
  } catch {
    // CI exports the variables instead of writing the file.
  }
  for (const key of ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_DB_URL"]) {
    if (!process.env[key]) throw new Error(`${key} is not configured for the e2e run`);
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  if (!/^http:\/\/(127\.0\.0\.1|localhost|192\.168\.|10\.)/.test(url)) {
    throw new Error(`refusing to run e2e against a non-local Supabase: ${url}`);
  }
}

const supabaseUrl = (): string => process.env.NEXT_PUBLIC_SUPABASE_URL!.replace(/\/$/, "");

async function supabase(path: string, init: RequestInit = {}): Promise<Response> {
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return fetch(`${supabaseUrl()}${path}`, {
    ...init,
    headers: {
      apikey: service,
      Authorization: `Bearer ${service}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
}

async function createUser(email: string, password: string): Promise<string> {
  const response = await supabase("/auth/v1/admin/users", {
    method: "POST",
    body: JSON.stringify({ email, password, email_confirm: true }),
  });
  const body = (await response.json()) as { id?: string };
  if (!response.ok || !body.id) throw new Error(`could not create ${email}: ${JSON.stringify(body).slice(0, 200)}`);
  return body.id;
}

async function signIn(email: string, password: string): Promise<string> {
  const response = await fetch(`${supabaseUrl()}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });
  const body = (await response.json()) as { access_token?: string };
  if (!body.access_token) throw new Error(`could not sign in ${email}`);
  return body.access_token;
}

async function mint(baseURL: string, token: string): Promise<string> {
  const response = await fetch(`${baseURL}/api/v1/me/invitations`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: "{}",
  });
  const body = (await response.json()) as { token?: string; error?: { code?: string } };
  if (!body.token) throw new Error(`could not mint an invitation: ${JSON.stringify(body).slice(0, 200)}`);
  return body.token;
}

export default async function globalSetup(): Promise<() => Promise<void>> {
  loadEnv();
  const baseURL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3003";
  const db = new Client({ connectionString: process.env.SUPABASE_DB_URL });
  await db.connect();

  const wipe = async (): Promise<void> => {
    await db.query(
      "delete from public.invitations where created_by in (select id from auth.users where email like 'qa-e2e-%@test.local')",
    );
    await db.query(
      "delete from public.profiles where id in (select id from auth.users where email like 'qa-e2e-%@test.local')",
    );
    await db.query("delete from auth.users where email like 'qa-e2e-%@test.local'");
  };

  const teardown = async (): Promise<void> => {
    await wipe().catch(() => {});
    await db.end().catch(() => {});
  };

  try {
    // Leftovers from a killed run must not break this one.
    await wipe();

    const adminId = await createUser(ADMIN.email, ADMIN.password);
    const existingId = await createUser(EXISTING.email, EXISTING.password);
    await db.query(
      "insert into public.profiles (id, display_name, role, invite_level, locale) " +
        "values ($1, 'E2E Admin', 'super_admin', null, 'en'), ($2, 'E2E Existing', 'user', 1, 'en') " +
        "on conflict (id) do update set display_name = excluded.display_name, role = excluded.role, " +
        "invite_level = excluded.invite_level, locale = excluded.locale",
      [adminId, existingId],
    );

    const adminToken = await signIn(ADMIN.email, ADMIN.password);
    const fixtures: Fixtures = {
      admin: { ...ADMIN, id: adminId, name: "E2E Admin" },
      existing: { ...EXISTING, id: existingId, name: "E2E Existing" },
      invitee: {
        email: `qa-e2e-new-${Date.now()}@test.local`,
        name: "E2E Nueva",
        password: "qa-e2e-new-password",
      },
      tokens: {
        newAccount: await mint(baseURL, adminToken),
        existingAccount: await mint(baseURL, adminToken),
      },
      baseURL,
    };
    writeFileSync(FIXTURES, `${JSON.stringify(fixtures, null, 2)}\n`, "utf8");
    return teardown;
  } catch (error) {
    await teardown();
    throw error;
  }
}

/** The fixtures the specs read; a missing file is a setup failure, not a test. */
export function fixtures(): Fixtures {
  return JSON.parse(readFileSync(FIXTURES, "utf8")) as Fixtures;
}
