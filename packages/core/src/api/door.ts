/**
 * The door: the thin edge every /api/v1 route goes through (ADR 0004).
 *
 * Pipeline (ADR 0007 + core-api spec): request id → CORS preflight → auth →
 * rate limit → zod validation → handler → error envelope. Every response,
 * success or failure, carries X-Request-Id and never leaks internals.
 *
 * Scope enforcement (ADR 0004) arrives with the authorization guard in task-02;
 * `options.scopes` is the declaration the guard will consume. No route uses
 * this door yet, so nothing ships without the guard.
 */

import { DomainError, httpStatusFor, toEnvelope } from '../errors.js';
import { checkRateLimit } from './rate-limit.js';
import type {
  Caller,
  DoorDeps,
  DoorOptions,
  JsonValue,
  LogEntry,
  RequestContext,
} from './types.js';

const BODY_METHODS = new Set(['POST', 'PATCH', 'PUT']);
const ALLOW_METHODS = 'GET,POST,PATCH,PUT,DELETE,OPTIONS';
const ALLOW_HEADERS = 'Authorization,Content-Type';
const WINDOW_SECONDS = 60;

interface CorsContext {
  allowed: boolean;
  origin: string | null;
}

function resolveCors(req: Request, options: DoorOptions): CorsContext {
  if (!options.cors) return { allowed: false, origin: null };
  const origin = req.headers.get('origin');
  if (!origin) return { allowed: false, origin: null };
  return { allowed: options.cors.allowlist.includes(origin), origin };
}

function corsHeaders(cors: CorsContext): Record<string, string> {
  if (!cors.allowed || !cors.origin) return {};
  return {
    'access-control-allow-origin': cors.origin,
    'access-control-expose-headers': 'X-Request-Id',
    vary: 'Origin',
  };
}

function baseHeaders(requestId: string, cors: CorsContext): Record<string, string> {
  return {
    'content-type': 'application/json',
    'x-request-id': requestId,
    ...corsHeaders(cors),
  };
}

function identityFor(caller: Caller, req: Request, kind: 'user' | 'key' | 'ip'): string {
  switch (kind) {
    case 'user':
      if (caller.kind === 'session' || caller.kind === 'delegated') return caller.userId;
      return 'anonymous';
    case 'key':
      if (caller.kind === 'service' || caller.kind === 'delegated') return caller.keyId;
      return 'anonymous';
    case 'ip': {
      const forwarded = req.headers.get('x-forwarded-for');
      const first = forwarded?.split(',')[0]?.trim();
      return first && first.length > 0 ? first : 'unknown';
    }
  }
}

function errorResponse(
  err: unknown,
  requestId: string,
  cors: CorsContext,
  deps: DoorDeps,
  extraHeaders: Record<string, string> = {},
): Response {
  const envelope = toEnvelope(err, requestId);
  const status = err instanceof DomainError ? httpStatusFor(err.code) : 500;

  const entry: LogEntry = {
    level: err instanceof DomainError ? 'warn' : 'error',
    requestId,
    code: envelope.error.code,
    message: err instanceof Error ? err.message : String(err),
    ...(err instanceof Error && err.stack ? { stack: err.stack } : {}),
  };
  deps.logger(entry);

  return new Response(JSON.stringify(envelope), {
    status,
    headers: { ...baseHeaders(requestId, cors), ...extraHeaders },
  });
}

/** Clones a handler Response to add the correlation header without losing its body. */
function withRequestId(res: Response, requestId: string, cors: CorsContext): Response {
  const headers = new Headers(res.headers);
  headers.set('x-request-id', requestId);
  for (const [key, value] of Object.entries(corsHeaders(cors))) headers.set(key, value);
  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers,
  });
}

async function readBody(req: Request, options: DoorOptions): Promise<unknown> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new DomainError('validation_failed', 'Invalid JSON body', {
      formErrors: ['Invalid JSON body'],
      fieldErrors: {},
    });
  }
  if (!options.schema) return raw;
  const parsed = options.schema.safeParse(raw);
  if (!parsed.success) {
    throw new DomainError('validation_failed', 'Validation failed', parsed.error.flatten());
  }
  return parsed.data;
}

export async function withDoor(
  req: Request,
  options: DoorOptions,
  deps: DoorDeps,
  handler: (ctx: RequestContext) => Promise<Response | JsonValue>,
): Promise<Response> {
  const requestId = crypto.randomUUID();
  const cors = resolveCors(req, options);

  // CORS preflight: answered before auth and rate limiting (no credentials needed).
  if (req.method === 'OPTIONS' && options.cors) {
    if (cors.origin && !cors.allowed) {
      return errorResponse(new DomainError('insufficient_scope'), requestId, cors, deps);
    }
    return new Response(null, {
      status: 204,
      headers: {
        ...corsHeaders(cors),
        'access-control-allow-methods': ALLOW_METHODS,
        'access-control-allow-headers': ALLOW_HEADERS,
        'x-request-id': requestId,
      },
    });
  }

  try {
    const caller = await options.auth(req);

    if (options.rateLimit) {
      const identity = identityFor(caller, req, options.rateLimit.identity);
      const result = await checkRateLimit(
        deps.rateLimitStorage,
        `${options.rateLimit.identity}:${identity}`,
        { limit: options.rateLimit.limit, windowSeconds: WINDOW_SECONDS },
      );
      if (!result.allowed) {
        return errorResponse(new DomainError('rate_limited'), requestId, cors, deps, {
          'retry-after': String(result.retryAfterSeconds),
        });
      }
    }

    const body = BODY_METHODS.has(req.method) ? await readBody(req, options) : undefined;

    const ctx: RequestContext = {
      requestId,
      caller,
      body,
      searchParams: new URL(req.url).searchParams,
    };

    const result = await handler(ctx);

    if (result instanceof Response) {
      return withRequestId(result, requestId, cors);
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: baseHeaders(requestId, cors),
    });
  } catch (err) {
    return errorResponse(err, requestId, cors, deps);
  }
}
