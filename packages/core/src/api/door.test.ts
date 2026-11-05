import { describe, expect, it, vi } from 'vitest';
import { withDoor } from './door';
import { DomainError, type ErrorEnvelope } from '../errors';
import type { Caller, DoorDeps, DoorOptions, LogEntry } from './types';
import type { RateLimitStorage } from './rate-limit-storage';
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

  it('maps a { status, body } handler result to the HTTP status and body', async () => {
    const res = await withDoor(
      new Request(URL_BASE, { method: 'POST', body: JSON.stringify({ email: 'a@b.c' }) }),
      makeOptions(),
      makeDeps(),
      async () => ({ status: 201, body: { user: { id: 'u1', email: 'a@b.c' } } }),
    );

    expect(res.status).toBe(201);
    expect(res.headers.get('content-type')).toContain('application/json');
    expect(res.headers.get('x-request-id')).toMatch(UUID);
    expect(await res.json()).toEqual({ user: { id: 'u1', email: 'a@b.c' } });
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
    expect(log?.message).toBe('Internal server error');
    expect(log?.requestId).toMatch(UUID);
  });

  it('renders an auth failure as 401', async () => {
    const res = await withDoor(
      new Request(URL_BASE),
      makeOptions({
        scopes: ['settings:read'],
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

  it('adds WWW-Authenticate to 401 responses', async () => {
    const res = await withDoor(
      new Request(URL_BASE),
      makeOptions({
        scopes: ['settings:read'],
        auth: async () => {
          throw new DomainError('unauthorized');
        },
      }),
      makeDeps(),
      async () => ({ ok: true }),
    );

    expect(res.status).toBe(401);
    expect(res.headers.get('www-authenticate')).toBe('Bearer');
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

  it('uses each service key as its own user identity (F-C)', async () => {
    const storage = makeStorage(1);
    const serviceCaller: Caller = { kind: 'service', keyId: 'key-abc', scopes: [], roleCap: 'admin' };
    await withDoor(
      new Request(URL_BASE),
      makeOptions({ auth: async () => serviceCaller, rateLimit: { identity: 'user', limit: 5 } }),
      makeDeps({ rateLimitStorage: storage }),
      async () => ({ ok: true }),
    );
    expect(storage.calls[0]).toBe('user:key-abc');
  });

  it('uses the delegated user id for the user identity (F-C)', async () => {
    const storage = makeStorage(1);
    const delegatedCaller: Caller = {
      kind: 'delegated',
      keyId: 'key-abc',
      userId: 'u9',
      scopes: [],
      roleCap: 'admin',
    };
    await withDoor(
      new Request(URL_BASE),
      makeOptions({ auth: async () => delegatedCaller, rateLimit: { identity: 'user', limit: 5 } }),
      makeDeps({ rateLimitStorage: storage }),
      async () => ({ ok: true }),
    );
    expect(storage.calls[0]).toBe('user:u9');
  });

  it('falls back to the anonymous bucket when no user identity is known (F-C)', async () => {
    const storage = makeStorage(1);
    await withDoor(
      new Request(URL_BASE),
      makeOptions({ auth: async () => ({ kind: 'anon' }), rateLimit: { identity: 'user', limit: 5 } }),
      makeDeps({ rateLimitStorage: storage }),
      async () => ({ ok: true }),
    );
    expect(storage.calls[0]).toBe('user:anonymous');
  });

  it('prefers x-real-ip over the other forwarded headers (F-B)', async () => {
    const storage = makeStorage(1);
    await withDoor(
      new Request(URL_BASE, {
        headers: { 'x-real-ip': '203.0.113.7', 'x-forwarded-for': '198.51.100.1, 10.0.0.1' },
      }),
      makeOptions({ rateLimit: { identity: 'ip', limit: 5 } }),
      makeDeps({ rateLimitStorage: storage }),
      async () => ({ ok: true }),
    );
    expect(storage.calls[0]).toBe('ip:203.0.113.7');
  });

  it('uses x-vercel-forwarded-for when x-real-ip is absent (F-B)', async () => {
    const storage = makeStorage(1);
    await withDoor(
      new Request(URL_BASE, {
        headers: { 'x-vercel-forwarded-for': '198.51.100.9, 10.0.0.1' },
      }),
      makeOptions({ rateLimit: { identity: 'ip', limit: 5 } }),
      makeDeps({ rateLimitStorage: storage }),
      async () => ({ ok: true }),
    );
    expect(storage.calls[0]).toBe('ip:198.51.100.9');
  });

  it('falls back to the first x-forwarded-for entry (F-B)', async () => {
    const storage = makeStorage(1);
    await withDoor(
      new Request(URL_BASE, {
        headers: { 'x-forwarded-for': '198.51.100.3, 10.0.0.1' },
      }),
      makeOptions({ rateLimit: { identity: 'ip', limit: 5 } }),
      makeDeps({ rateLimitStorage: storage }),
      async () => ({ ok: true }),
    );
    expect(storage.calls[0]).toBe('ip:198.51.100.3');
  });

  it('uses the unknown bucket when no forwarding header is present (F-B)', async () => {
    const storage = makeStorage(1);
    await withDoor(
      new Request(URL_BASE),
      makeOptions({ rateLimit: { identity: 'ip', limit: 5 } }),
      makeDeps({ rateLimitStorage: storage }),
      async () => ({ ok: true }),
    );
    expect(storage.calls[0]).toBe('ip:unknown');
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

  it('rejects an oversized declared body with 413 payload_too_large (F-E)', async () => {
    const res = await withDoor(
      new Request(URL_BASE, {
        method: 'POST',
        headers: { 'content-length': String(1024 * 1024 + 1), 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'Ada' }),
      }),
      makeOptions({ schema }),
      makeDeps(),
      async () => ({ ok: true }),
    );

    expect(res.status).toBe(413);
    const body = (await res.json()) as ErrorEnvelope;
    expect(body.error.code).toBe('payload_too_large');
  });

  it('parses a body normally when no content-length header is present (F-E)', async () => {
    const req = new Request(URL_BASE, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Ada' }),
    });
    req.headers.delete('content-length');

    const res = await withDoor(req, makeOptions({ schema }), makeDeps(), async (ctx) => ({
      name: (ctx.body as { name: string }).name,
    }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ name: 'Ada' });
  });

  it('rejects an oversized chunked body (no content-length) with 413 payload_too_large', async () => {
    // 1.1 MB of padding without a content-length header: the stream itself
    // must be capped, not just the declared length.
    const padding = 'x'.repeat(1024 * 1024 + 64 * 1024);
    const req = new Request(URL_BASE, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: padding }),
    });
    req.headers.delete('content-length');

    const res = await withDoor(req, makeOptions({ schema }), makeDeps(), async () => ({ ok: true }));

    expect(res.status).toBe(413);
    const body = (await res.json()) as ErrorEnvelope;
    expect(body.error.code).toBe('payload_too_large');
  });
});

describe('withDoor — scopes (F8)', () => {
  it('rejects a caller lacking a required scope with 403 insufficient_scope', async () => {
    const deps = makeDeps();
    const userCaller: Caller = { kind: 'session', userId: 'u2', role: 'user' };
    const handler = vi.fn().mockResolvedValue({ ok: true });

    const res = await withDoor(
      new Request(URL_BASE),
      makeOptions({ scopes: ['settings:write'], auth: async () => userCaller }),
      deps,
      handler,
    );

    expect(res.status).toBe(403);
    const body = (await res.json()) as ErrorEnvelope;
    expect(body.error.code).toBe('insufficient_scope');
    expect(handler).not.toHaveBeenCalled();
  });

  it('allows a caller holding all required scopes and passes it to the handler', async () => {
    const deps = makeDeps();
    const handler = vi.fn().mockResolvedValue({ ok: true });

    const res = await withDoor(
      new Request(URL_BASE),
      makeOptions({ scopes: ['settings:read'] }),
      deps,
      handler,
    );

    expect(res.status).toBe(200);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0]?.[0]?.caller).toEqual(sessionCaller);
  });

  it('rejects an anon caller when scopes are required with 401 unauthorized', async () => {
    const deps = makeDeps();
    const handler = vi.fn().mockResolvedValue({ ok: true });

    const res = await withDoor(
      new Request(URL_BASE),
      makeOptions({ scopes: ['settings:read'], auth: async () => ({ kind: 'anon' }) }),
      deps,
      handler,
    );

    expect(res.status).toBe(401);
    const body = (await res.json()) as ErrorEnvelope;
    expect(body.error.code).toBe('unauthorized');
    expect(handler).not.toHaveBeenCalled();
  });

  it('lets an anon caller through when no scopes are required (public routes)', async () => {
    const deps = makeDeps();
    const handler = vi.fn().mockResolvedValue({ ok: true });

    const res = await withDoor(
      new Request(URL_BASE),
      makeOptions({ scopes: [], auth: async () => ({ kind: 'anon' }) }),
      deps,
      handler,
    );

    expect(res.status).toBe(200);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0]?.[0]?.caller).toEqual({ kind: 'anon' });
  });
});

describe('withDoor — public route auth fallback (F-A)', () => {
  it('treats an unauthorized auth failure as anon on public routes', async () => {
    const handler = vi.fn().mockResolvedValue({ ok: true });
    const res = await withDoor(
      new Request(URL_BASE),
      makeOptions({
        scopes: [],
        auth: async () => {
          throw new DomainError('unauthorized');
        },
      }),
      makeDeps(),
      handler,
    );

    expect(res.status).toBe(200);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0]?.[0]?.caller).toEqual({ kind: 'anon' });
  });

  it('still fails on a non-unauthorized DomainError for public routes', async () => {
    const res = await withDoor(
      new Request(URL_BASE),
      makeOptions({
        scopes: [],
        auth: async () => {
          throw new DomainError('internal', 'auth backend down');
        },
      }),
      makeDeps(),
      async () => ({ ok: true }),
    );

    expect(res.status).toBe(500);
    const body = (await res.json()) as ErrorEnvelope;
    expect(body.error.code).toBe('internal');
  });

  it('still fails on a generic error for public routes', async () => {
    const res = await withDoor(
      new Request(URL_BASE),
      makeOptions({
        scopes: [],
        auth: async () => {
          throw new Error('boom');
        },
      }),
      makeDeps(),
      async () => ({ ok: true }),
    );

    expect(res.status).toBe(500);
  });

  it('keeps 401 for an unauthorized auth failure on scoped routes', async () => {
    const handler = vi.fn().mockResolvedValue({ ok: true });
    const res = await withDoor(
      new Request(URL_BASE),
      makeOptions({
        scopes: ['settings:read'],
        auth: async () => {
          throw new DomainError('unauthorized');
        },
      }),
      makeDeps(),
      handler,
    );

    expect(res.status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
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
    expect(body.error.code).toBe('cors_origin_not_allowed');
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

describe('withDoor — 5xx reporting', () => {
  it('reports unexpected 5xx errors with correlation context', async () => {
    const captureError = vi.fn();
    const deps = makeDeps({ captureError });
    const res = await withDoor(
      new Request(`${URL_BASE}?x=1`),
      makeOptions(),
      deps,
      async () => {
        throw new Error('boom');
      },
    );

    expect(res.status).toBe(500);
    expect(captureError).toHaveBeenCalledTimes(1);
    const [err, context] = captureError.mock.calls[0]!;
    expect((err as Error).message).toBe('boom');
    expect(context.code).toBe('internal');
    expect(context.route).toBe('GET /api/v1/resource');
    expect(context.requestId).toMatch(UUID);
  });

  it('does not report 4xx responses', async () => {
    const captureError = vi.fn();
    const res = await withDoor(
      new Request(URL_BASE),
      makeOptions(),
      makeDeps({ captureError }),
      async () => {
        throw new DomainError('validation_failed');
      },
    );

    expect(res.status).toBe(400);
    expect(captureError).not.toHaveBeenCalled();
  });
});
