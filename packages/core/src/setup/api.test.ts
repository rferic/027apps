import { describe, expect, it, vi } from 'vitest';
import type { Caller, DoorDeps, LogEntry } from '../api/types';
import { setupEnvironmentRoute, setupTestEmailRoute, type SetupRouteDeps } from './api.js';
import type { EnvironmentDeps } from './environment.js';

const TABLES = ['profiles', 'settings', 'settings_categories', 'currencies', 'rate_limit_counters'];
const BASE = 'https://api.test/api/v1/setup';

const superAdmin: Caller = { kind: 'session', userId: 'admin-1', role: 'super_admin' };
const plainAdmin: Caller = { kind: 'session', userId: 'admin-2', role: 'admin' };
const anonymous: Caller = { kind: 'anon' };

function makeDeps(caller: Caller, installed = false) {
  const logs: LogEntry[] = [];
  const door: DoorDeps & { logs: LogEntry[] } = {
    logs,
    rateLimitStorage: { increment: async () => ({ count: 1 }) },
    logger: (entry) => logs.push(entry),
  };
  const env: EnvironmentDeps = {
    db: {
      query: async (sql) =>
        sql.includes('information_schema')
          ? { rows: TABLES.map((table_name) => ({ table_name })) }
          : { rows: [{}] },
    },
    encryptionKey: { present: true, valid: true },
    sentryConfigured: false,
  };
  const deps: SetupRouteDeps = {
    door,
    auth: async () => caller,
    env,
    installed: async () => installed,
  };
  return { deps, logs };
}

describe('setupEnvironmentRoute', () => {
  it('reports the environment while the instance is uninstalled', async () => {
    const { deps } = makeDeps(anonymous);
    const res = await setupEnvironmentRoute(deps)(new Request(`${BASE}/environment`));

    expect(res.status).toBe(200);
    const body = (await res.json()) as { environment: { ready: boolean; checks: unknown[] } };
    expect(body.environment.ready).toBe(true);
    expect(body.environment.checks).toHaveLength(4);
  });

  it('answers already_setup once the super_admin exists', async () => {
    const { deps } = makeDeps(anonymous, true);
    const res = await setupEnvironmentRoute(deps)(new Request(`${BASE}/environment`));

    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('already_setup');
  });
});

describe('setupTestEmailRoute', () => {
  function route(caller: Caller, sendTestEmail = vi.fn(async () => undefined)) {
    const { deps, logs } = makeDeps(caller);
    const handler = setupTestEmailRoute({ ...deps, sendTestEmail });
    return { handler, sendTestEmail, logs };
  }

  it('sends the test email to the authenticated super_admin', async () => {
    const { handler, sendTestEmail } = route(superAdmin);
    const res = await handler(new Request(`${BASE}/test-email`, { method: 'POST', body: '{}' }));

    expect(res.status).toBe(200);
    expect(sendTestEmail).toHaveBeenCalledWith('admin-1');
  });

  it('accepts a POST with no body (the contract documents an empty body)', async () => {
    const { handler, sendTestEmail } = route(superAdmin);
    const res = await handler(new Request(`${BASE}/test-email`, { method: 'POST' }));

    expect(res.status).toBe(200);
    expect(sendTestEmail).toHaveBeenCalledWith('admin-1');
  });

  it('rejects a non-super_admin session', async () => {
    const { handler, sendTestEmail } = route(plainAdmin);
    const res = await handler(new Request(`${BASE}/test-email`, { method: 'POST', body: '{}' }));

    expect(res.status).toBe(403);
    expect(sendTestEmail).not.toHaveBeenCalled();
  });

  it('rejects anonymous callers', async () => {
    const { handler } = route(anonymous);
    const res = await handler(new Request(`${BASE}/test-email`, { method: 'POST', body: '{}' }));

    expect(res.status).toBe(401);
  });

  it('never takes the destination address from the request body', async () => {
    const { handler, sendTestEmail } = route(superAdmin);
    const res = await handler(
      new Request(`${BASE}/test-email`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'attacker@example.com' }),
      }),
    );

    // Strict body: an unexpected field is a validation error, not a destination.
    expect(res.status).toBe(400);
    expect(sendTestEmail).not.toHaveBeenCalled();
  });

  it('logs and hides mailer failures', async () => {
    const failing = vi.fn(async () => {
      throw new Error('SMTP down');
    });
    const { handler, logs } = route(superAdmin, failing);
    const res = await handler(new Request(`${BASE}/test-email`, { method: 'POST', body: '{}' }));

    expect(res.status).toBe(500);
    expect(logs.some((entry) => entry.message.includes('setup test email failed'))).toBe(true);
  });
});
