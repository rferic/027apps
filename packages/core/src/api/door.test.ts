import { describe, expect, it } from 'vitest';
import { withDoor } from './door.js';
import { DomainError, type ErrorEnvelope } from '../errors.js';
import type { Caller, DoorDeps, DoorOptions, LogEntry } from './types.js';
import type { RateLimitStorage } from './rate-limit-storage.js';
import { z } from 'zod';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const URL_BASE = 'https://api.test/api/v1/resource';

const sessionCaller: Caller = { kind: 'session', userId: 'u1', role: 'admin' };

function makeStorage(count: number): RateLimitStorage & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    async increment(key) {
      calls.push(key);
      return { count };
    },
  };
}

function makeDeps(overrides: Partial<DoorDeps> = {}): DoorDeps & { logs: LogEntry[] } {
  const logs: LogEntry[] = [];
  return {
    logs,
    rateLimitStorage: makeStorage(1),
    logger: (entry) => logs.push(entry),
    ...overrides,
  };
}

function makeOptions(overrides: Partial<DoorOptions> = {}): DoorOptions {
  return {
    scopes: [],
    auth: async () => sessionCaller,
    ...overrides,
  };
}

describe('withDoor — success', () => {
  it('serializes a JsonValue as JSON 200 with X-Request-Id', async () => {
    const res = await withDoor(
      new Request(URL_BASE),
      makeOptions(),
      makeDeps(),
      async () => ({ ok: true }),
    );

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/json');
    expect(res.headers.get('x-request-id')).toMatch(UUID);
    expect(await res.json()).toEqual({ ok: true });
  });

  it('returns a handler Response as-is and still adds X-Request-Id', async () => {
    const res = await withDoor(
      new Request(URL_BASE),
      makeOptions(),
      makeDeps(),
      async () => new Response('raw', { status: 201 }),
    );

    expect(res.status).toBe(201);
    expect(res.headers.get('x-request-id')).toMatch(UUID);
    expect(await res.text()).toBe('raw');
  });

  it('passes requestId, caller and search params to the handler', async () => {
    const res = await withDoor(
      new Request(`${URL_BASE}?page=2`),
      makeOptions(),
      makeDeps(),
      async (ctx) => ({
        requestId: ctx.requestId,
        caller: ctx.caller.kind,
        page: ctx.searchParams.get('page'),
      }),
    );

    const body = (await res.json()) as {
      requestId: string;
      caller: string;
      page: string;
    };
    expect(body.caller).toBe('session');
    expect(body.page).toBe('2');
    expect(body.requestId).toBe(res.headers.get('x-request-id'));
  });
});

describe('withDoor — errors', () => {
  it('renders a DomainError as the ADR 0007 envelope with its HTTP status', async () => {
    const res = await withDoor(new Request(URL_BASE), makeOptions(), makeDeps(), async () => {
      throw new DomainError('not_found');
    });

    expect(res.status).toBe(404);
    const body = (await res.json()) as ErrorEnvelope;
    expect(body.error.code).toBe('not_found');
    expect(body.error.message).toBe('Resource not found');
    expect(body.error.request_id).toMatch(UUID);
    expect(body.error.request_id).toBe(res.headers.get('x-request-id'));
    expect(body.error).not.toHaveProperty('details');
  });

  it('maps an unknown error to internal 500 without leaking internals', async () => {
    const deps = makeDeps();
    const res = await withDoor(new Request(URL_BASE), makeOptions(), deps, async () => {
      throw new Error('SQLSTATE 23505 at /src/db.ts');
    });

    expect(res.status).toBe(500);
    const serialized = JSON.stringify(await res.json());
    expect(serialized).toContain('internal');
    expect(serialized).not.toContain('SQLSTATE');
    expect(serialized).not.toContain('/src/');

    const log = deps.logs.find((entry) => entry.level === 'error');
    expect(log?.code).toBe('internal');
    expect(log?.message).toContain('SQLSTATE');
    expect(log?.requestId).toMatch(UUID);
  });

  it('renders an auth failure as 401', async () => {
    const res = await withDoor(
      new Request(URL_BASE),
      makeOptions({
        auth: async () => {
          throw new DomainError('unauthorized');
        },
      }),
      makeDeps(),
      async () => ({ ok: true }),
    );

    expect(res.status).toBe(401);
    const body = (await res.json()) as ErrorEnvelope;
    expect(body.error.code).toBe('unauthorized');
  });
});

describe('withDoor — rate limiting', () => {
  it('returns 429 with Retry-After when the limit is exceeded', async () => {
    const storage = makeStorage(3);
    const res = await withDoor(
      new Request(URL_BASE),
      makeOptions({ rateLimit: { identity: 'user', limit: 2 } }),
      makeDeps({ rateLimitStorage: storage }),
      async () => ({ ok: true }),
    );

    expect(res.status).toBe(429);
    expect(Number(res.headers.get('retry-after'))).toBeGreaterThan(0);
    const body = (await res.json()) as ErrorEnvelope;
    expect(body.error.code).toBe('rate_limited');
    expect(storage.calls[0]).toBe('user:u1');
  });

  it('runs the handler when the request is within the limit', async () => {
    const storage = makeStorage(2);
    const res = await withDoor(
      new Request(URL_BASE),
      makeOptions({ rateLimit: { identity: 'user', limit: 2 } }),
      makeDeps({ rateLimitStorage: storage }),
      async () => ({ ok: true }),
    );

    expect(res.status).toBe(200);
    expect(storage.calls).toHaveLength(1);
  });
});

describe('withDoor — validation', () => {
  const schema = z.object({ name: z.string() }).strict();

  it('returns 400 with zod details for an invalid body', async () => {
    const res = await withDoor(
      new Request(URL_BASE, { method: 'POST', body: JSON.stringify({ name: 1 }) }),
      makeOptions({ schema }),
      makeDeps(),
      async () => ({ ok: true }),
    );

    expect(res.status).toBe(400);
    const body = (await res.json()) as ErrorEnvelope;
    expect(body.error.code).toBe('validation_failed');
    const details = body.error.details as { fieldErrors: { name?: string[] } } | undefined;
    expect(details).toBeDefined();
    expect(details?.fieldErrors.name).toBeDefined();
  });

  it('passes the parsed body to the handler', async () => {
    const res = await withDoor(
      new Request(URL_BASE, { method: 'POST', body: JSON.stringify({ name: 'Ada' }) }),
      makeOptions({ schema }),
      makeDeps(),
      async (ctx) => ({ name: (ctx.body as { name: string }).name }),
    );

    expect(await res.json()).toEqual({ name: 'Ada' });
  });

  it('rejects malformed JSON as validation_failed', async () => {
    const res = await withDoor(
      new Request(URL_BASE, { method: 'POST', body: '{not json' }),
      makeOptions({ schema }),
      makeDeps(),
      async () => ({ ok: true }),
    );

    expect(res.status).toBe(400);
    const body = (await res.json()) as ErrorEnvelope;
    expect(body.error.code).toBe('validation_failed');
  });
});

describe('withDoor — CORS', () => {
  const cors = { allowlist: ['https://admin.test'] };

  it('answers a preflight from an allowed origin with 204 and headers', async () => {
    const res = await withDoor(
      new Request(URL_BASE, {
        method: 'OPTIONS',
        headers: { Origin: 'https://admin.test', 'Access-Control-Request-Method': 'POST' },
      }),
      makeOptions({ cors }),
      makeDeps(),
      async () => ({ ok: true }),
    );

    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-origin')).toBe('https://admin.test');
    expect(res.headers.get('access-control-allow-methods')).toContain('POST');
    expect(res.headers.get('access-control-expose-headers')).toContain('X-Request-Id');
  });

  it('rejects a preflight from a non-listed origin with 403', async () => {
    const res = await withDoor(
      new Request(URL_BASE, {
        method: 'OPTIONS',
        headers: { Origin: 'https://evil.test', 'Access-Control-Request-Method': 'POST' },
      }),
      makeOptions({ cors }),
      makeDeps(),
      async () => ({ ok: true }),
    );

    expect(res.status).toBe(403);
    expect(res.headers.get('access-control-allow-origin')).toBeNull();
    const body = (await res.json()) as ErrorEnvelope;
    expect(body.error.code).toBe('insufficient_scope');
  });

  it('adds CORS headers to allowed actual requests', async () => {
    const res = await withDoor(
      new Request(URL_BASE, { headers: { Origin: 'https://admin.test' } }),
      makeOptions({ cors }),
      makeDeps(),
      async () => ({ ok: true }),
    );

    expect(res.headers.get('access-control-allow-origin')).toBe('https://admin.test');
    expect(res.headers.get('vary')).toContain('Origin');
  });

  it('does not add CORS headers when no Origin is present', async () => {
    const res = await withDoor(new Request(URL_BASE), makeOptions({ cors }), makeDeps(), async () => ({
      ok: true,
    }));

    expect(res.headers.get('access-control-allow-origin')).toBeNull();
  });
});
