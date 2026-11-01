import type { RateLimitStorage } from './rate-limit-storage';
import type { ZodType } from 'zod';

/** Who is calling the API. The shape is resolved by the auth function. */
export type Caller =
  | { kind: 'session'; userId: string; role: 'super_admin' | 'admin' | 'user' }
  | { kind: 'service'; keyId: string; scopes: string[]; roleCap: 'admin' | 'super_admin' }
  | {
      kind: 'delegated';
      keyId: string;
      scopes: string[];
      roleCap: 'admin' | 'super_admin';
      userId: string;
    }
  | { kind: 'anon' };

export interface RequestContext {
  requestId: string;
  caller: Caller;
  body?: unknown;
  searchParams: URLSearchParams;
}

export interface CorsOptions {
  /** Exact origins allowed, e.g. ["https://admin.example.com"]. No wildcards. */
  allowlist: string[];
}

export interface DoorOptions {
  /** Scopes the action requires. Consumed by the authorization guard (task-02). */
  scopes: string[];
  auth: (req: Request) => Promise<Caller>;
  /** Fixed one-minute window. Identity is derived from the caller. */
  rateLimit?: { identity: 'user' | 'key' | 'ip'; limit: number };
  /** Omit to skip CORS handling entirely. */
  cors?: CorsOptions;
  /** Validates bodies of POST/PATCH/PUT with `.safeParse()` (strictness lives in the schema). */
  schema?: ZodType;
}

export type LogLevel = 'info' | 'warn' | 'error';

export interface LogEntry {
  level: LogLevel;
  requestId: string;
  code?: string;
  message: string;
  stack?: string;
}

export interface DoorDeps {
  rateLimitStorage: RateLimitStorage;
  logger: (entry: LogEntry) => void;
}

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };
