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

import { DomainError, httpStatusFor, toEnvelope } from '../errors';
import { authorize } from '../auth/guard';
import { checkRateLimit } from './rate-limit';
import type {
  Caller,
  DoorDeps,
  DoorOptions,
  JsonValue,
  LogEntry,
  RequestContext,
} from './types';

const BODY_METHODS = new Set(['POST', 'PATCH', 'PUT']);
const ALLOW_METHODS = 'GET,POST,PATCH,PUT,DELETE,OPTIONS';
const ALLOW_HEADERS = 'Authorization,Content-Type';
const WINDOW_SECONDS = 60;
/** Maximum accepted request body (1 MB) when the client declares a length. */
/** Body size cap for requests with no trustworthy `content-length` header. */
const MAX_BODY_BYTES = 1024 * 1024;

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
      // A service key gets its own bucket; otherwise every key collapses together.
      if (caller.kind === 'service') return caller.keyId;
      return 'anonymous';
    case 'key':
      if (caller.kind === 'service' || caller.kind === 'delegated') return caller.keyId;
      return 'anonymous';
    case 'ip': {
      // Self-hosted deployments MUST set x-real-ip (or strip incoming XFF) at the
      // reverse proxy. x-forwarded-for is only a last-resort fallback because a
      // client can spoof it when no proxy rewrites the header.
      const realIp = req.headers.get('x-real-ip')?.split(',')[0]?.trim();
      if (realIp) return realIp;
      const vercelIp = req.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim();
      if (vercelIp) return vercelIp;
      const forwarded = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
      return forwarded && forwarded.length > 0 ? forwarded : 'unknown';
    }
  }
}

/** Method + path for logs; ids/tokens are redacted (never the raw value). */
export function routeOf(req: Request): string {
  const pathname = new URL(req.url)
    .pathname.replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:id')
    .replace(/\/[A-Za-z0-9_-]{24,}/g, '/:token');
  return `${req.method} ${pathname}`;
}

function errorResponse(
  err: unknown,
  requestId: string,
  cors: CorsContext,
  deps: DoorDeps,
  route: string,
  extraHeaders: Record<string, string> = {},
): Response {
  const envelope = toEnvelope(err, requestId);
  const status = err instanceof DomainError ? httpStatusFor(err.code) : 500;

  const entry: LogEntry = {
    level: err instanceof DomainError ? 'warn' : 'error',
    requestId,
    code: envelope.error.code,
    // Never log a raw 500 message: it may carry SQL or PII.
    message: err instanceof DomainError ? err.message : 'Internal server error',
    ...(err instanceof Error && err.stack ? { stack: err.stack } : {}),
  };
  deps.logger(entry);
  if (status >= 500 && deps.captureError) {
    deps.captureError(err, { requestId, route, code: envelope.error.code });
  }

  const headers = { ...baseHeaders(requestId, cors), ...extraHeaders };
  if (status === 401) {
    headers['www-authenticate'] = 'Bearer';
  }
  return new Response(JSON.stringify(envelope), {
    status,
    headers,
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

/**
 * Reads the request body as text under a hard byte cap. Used when no
 * trustworthy `content-length` header is present (chunked transfer, proxies
 * that strip the header): the stream is consumed incrementally and aborted as
 * soon as the cap is exceeded, so an attacker cannot stream an unbounded body.
 */
async function readBodyText(req: Request): Promise<string> {
  if (!req.body) return '';
  const reader = req.body.getReader();
  const decoder = new TextDecoder();
  let total = 0;
  let text = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BODY_BYTES) {
      await reader.cancel();
      throw new DomainError('payload_too_large');
    }
    text += decoder.decode(value, { stream: true });
  }
  text += decoder.decode();
  return text;
}

async function readBody(req: Request, options: DoorOptions): Promise<unknown> {
  // Reject oversized bodies before parsing. Only when the header is present
  // and numeric can it be trusted to reflect the real size; otherwise the
  // stream itself is read under the hard cap.
  const declaredLength = req.headers.get('content-length');
  let text: string;
  if (declaredLength !== null) {
    const length = Number(declaredLength);
    if (!Number.isFinite(length) || length < 0) {
      text = await readBodyText(req);
    } else if (length > MAX_BODY_BYTES) {
      throw new DomainError('payload_too_large');
    } else {
      text = await req.text();
    }
  } else {
    text = await readBodyText(req);
  }

  // Bodyless POST/PATCH/PUT (e.g. adding an existing member) are legitimate:
  // an empty payload reaches the handler as `undefined`, so the route decides
  // whether it accepts it. Malformed JSON still fails closed.
  if (text.trim() === '') {
    if (!options.schema) return undefined;
    const parsedEmpty = options.schema.safeParse(undefined);
    if (!parsedEmpty.success) {
      throw new DomainError('validation_failed', 'Validation failed', parsedEmpty.error.flatten());
    }
    return parsedEmpty.data;
  }

  let raw: unknown;
  try {
    raw = JSON.parse(text);
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
  const started = Date.now();
  let actor: string | undefined;
  const response = await runDoor(req, options, deps, handler, requestId, (caller) => {
    actor = actorLabel(caller);
  });

  deps.logger({
    level: response.status >= 500 ? 'error' : 'info',
    requestId,
    message: 'request completed',
    route: routeOf(req),
    status: response.status,
    durationMs: Date.now() - started,
    ...(actor ? { actor } : {}),
  });
  return response;
}

/** Correlation label for the log: never the email or IP. */
function actorLabel(caller: Caller): string {
  switch (caller.kind) {
    case 'session':
    case 'delegated':
      return `session:${caller.userId}`;
    case 'service':
      return `service:${caller.keyId}`;
    case 'anon':
      return 'anon';
  }
}

async function runDoor(
  req: Request,
  options: DoorOptions,
  deps: DoorDeps,
  handler: (ctx: RequestContext) => Promise<Response | JsonValue>,
  requestId: string,
  onCaller: (caller: Caller) => void,
): Promise<Response> {
  const cors = resolveCors(req, options);

  // CORS preflight: answered before auth and rate limiting (no credentials needed).
  if (req.method === 'OPTIONS' && options.cors) {
    if (cors.origin && !cors.allowed) {
      return errorResponse(new DomainError('cors_origin_not_allowed'), requestId, cors, deps, routeOf(req));
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
    // Public routes tolerate an invalid/expired token so mobile clients can keep
    // fetching /instance and /health between refreshes; scoped routes keep 401.
    let caller: Caller;
    try {
      caller = await options.auth(req);
    } catch (err) {
      if (options.scopes.length === 0 && err instanceof DomainError && err.code === 'unauthorized') {
        caller = { kind: 'anon' };
      } else {
        throw err;
      }
    }

    // Scope enforcement (ADR 0004): the guard consumes options.scopes before
    // rate limiting, so unauthorized callers never consume rate-limit budget.
    // With an empty scopes list the route is public: the caller passes through.
    const authorizedCaller = options.scopes.length > 0 ? authorize(caller, options.scopes) : caller;
    onCaller(authorizedCaller);

    if (options.rateLimit) {
      const identity = identityFor(authorizedCaller, req, options.rateLimit.identity);
      const result = await checkRateLimit(
        deps.rateLimitStorage,
        `${options.rateLimit.identity}:${identity}`,
        { limit: options.rateLimit.limit, windowSeconds: WINDOW_SECONDS },
      );
      if (!result.allowed) {
        return errorResponse(new DomainError('rate_limited'), requestId, cors, deps, routeOf(req), {
          'retry-after': String(result.retryAfterSeconds),
        });
      }
    }

    const body = BODY_METHODS.has(req.method) ? await readBody(req, options) : undefined;

    const ctx: RequestContext = {
      requestId,
      caller: authorizedCaller,
      body,
      searchParams: new URL(req.url).searchParams,
    };

    const result = await handler(ctx);

    if (result instanceof Response) {
      return withRequestId(result, requestId, cors);
    }

    // Handler convention: { status, body } customizes the HTTP status (e.g. 201).
    if (
      result !== null &&
      typeof result === 'object' &&
      'status' in result &&
      'body' in result
    ) {
      const { status, body: responseBody } = result as { status: number; body: JsonValue };
      return new Response(JSON.stringify(responseBody), {
        status,
        headers: baseHeaders(requestId, cors),
      });
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: baseHeaders(requestId, cors),
    });
  } catch (err) {
    return errorResponse(err, requestId, cors, deps, routeOf(req));
  }
}
