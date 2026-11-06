import { Client, type ClientBase } from 'pg';

/**
 * Connection to the local Supabase stack database (postgres superuser):
 * creates/drops test schemas and users, applies RLS policies in its tests.
 * Never connects to a cloud project: 127.0.0.1:54322 only.
 */
export function dbUrl(): string {
  const url = process.env.SUPABASE_DB_URL;
  if (!url) {
    throw new Error('SUPABASE_DB_URL is not set (expected the local Supabase stack URL)');
  }
  if (!url.includes('127.0.0.1') && !url.includes('localhost')) {
    throw new Error('Refusing to run db-tests against a non-local database');
  }
  return url;
}

export async function withClient<T>(fn: (c: ClientBase) => Promise<T>): Promise<T> {
  const client = new Client({ connectionString: dbUrl() });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

export async function query(c: ClientBase, sql: string, params: unknown[] = []): Promise<{ rows: Record<string, unknown>[] }> {
  const res = await c.query(sql, params);
  return { rows: res.rows as Record<string, unknown>[] };
}

export async function count(c: ClientBase, sql: string, params: unknown[] = []): Promise<number> {
  // Accepts any column name (count(*), count, n): takes the first value.
  const res = await c.query(sql, params);
  const first = res.rows[0] as Record<string, unknown> | undefined;
  if (!first) return 0;
  return Number(Object.values(first)[0] ?? 0);
}

/**
 * JWT impersonation in the current transaction: sets the authenticated role and
 * request.jwt.claims with the user's sub. It only takes effect inside a
 * transaction (BEGIN ... COMMIT) because it uses SET LOCAL.
 */
export async function impersonate(c: ClientBase, userId: string, role = 'authenticated'): Promise<void> {
  await c.query(`SET LOCAL ROLE ${role}`);
  await c.query(`SELECT set_config('request.jwt.claims', $1, true)`, [
    JSON.stringify({ sub: userId, role: 'authenticated', aud: 'authenticated' }),
  ]);
}

/** Anon impersonation: anon role without claims. */
export async function impersonateAnon(c: ClientBase): Promise<void> {
  await c.query('SET LOCAL ROLE anon');
  await c.query(`SELECT set_config('request.jwt.claims', $1, true)`, [
    JSON.stringify({ role: 'anon', aud: 'anon' }),
  ]);
}

/**
 * Creates an Auth user on the local stack with an associated profile.
 * Inserts directly into auth.users and public.profiles (the local stack allows
 * this as superuser; in cloud this goes through the Admin API).
 * The id is generated here: auth.users.id has no default on the local stack.
 */
export async function createTestUser(
  c: ClientBase,
  opts: { email: string; role?: 'super_admin' | 'admin' | 'user'; displayName?: string },
): Promise<{ id: string }> {
  const id = crypto.randomUUID();
  await c.query(
    `insert into auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role)
     values ($1, '00000000-0000-0000-0000-000000000000', $2, crypt('test-password', gen_salt('bf')), now(),
             '{"provider":"email","providers":["email"]}', '{}', 'authenticated', 'authenticated')`,
    [id, opts.email],
  );
  await c.query(
    `insert into public.profiles (id, display_name, role) values ($1, $2, $3)`,
    [id, opts.displayName ?? 'Test User', opts.role ?? 'user'],
  );
  return { id };
}
