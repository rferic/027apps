import { DomainError } from "../errors";
import type { JsonValue } from "../api/types";
import type { QueryClient } from "../api/rate-limit-storage";

/**
 * Transactional outbox + realtime dispatch (realtime spec §5). Use cases insert
 * events in their own transaction; `publishPending` claims a batch, validates
 * the target against the closed list/module channels, publishes the wire
 * envelope, runs hooks and push, and marks the event published or retries with
 * exponential backoff. Failed is terminal after the configured attempts.
 */
export interface RealtimePort {
  publish(topic: string, message: { type: string; resource: JsonValue; payload?: JsonValue }): Promise<void>;
}

export interface HooksPort {
  /** Runs module hooks; must be idempotent by event_id. Returns applied module keys. */
  run(event: OutboxEvent): Promise<string[]>;
}

export interface PushPort {
  send(
    tokens: string[],
    data: Record<string, string>,
  ): Promise<{ token: string; error?: "UNREGISTERED" | "INVALID_ARGUMENT" | "RETRY" }[]>;
}

export interface RealtimeDeps {
  db: QueryClient;
  realtime?: RealtimePort;
  hooks?: HooksPort;
  push?: PushPort;
  logger?: (entry: { level: "warn" | "error"; message: string; eventId?: string }) => void;
  maxAttempts?: number;
}

export type OutboxEvent = {
  event_id: string;
  request_id: string | null;
  module_key: string | null;
  type: string;
  target: string;
  subject_id: string | null;
  resource: JsonValue;
  payload: JsonValue | null;
  notify: string[] | null;
  attempts: number;
  hook_applied: string[] | null;
};

export type OutboxInput = {
  type: string;
  target: string;
  subject_id?: string | null;
  module_key?: string | null;
  resource: JsonValue;
  payload?: JsonValue | null;
  notify?: string[] | null;
  request_id?: string | null;
};

const TARGET = /^(admins|all|user|channel:[a-z0-9][a-z0-9-]*(\{[a-z_]+\})?)$/;
const DEFAULT_MAX_ATTEMPTS = 8;

/** Inserts one event inside the caller's transaction (no external effect yet). */
export async function enqueueEvent(db: QueryClient, event: OutboxInput): Promise<void> {
  if (!TARGET.test(event.target)) throw new DomainError("validation_failed", "invalid event target");
  if (event.target === "user" && !event.subject_id) {
    throw new DomainError("validation_failed", "user events need a subject");
  }
  if (event.notify && event.notify.some((value) => value !== "push")) {
    throw new DomainError("validation_failed", "unsupported notification channel");
  }
  await db.query(
    `insert into public.event_outbox
       (request_id, module_key, type, target, subject_id, resource, payload, notify)
     values ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      event.request_id ?? null,
      event.module_key ?? null,
      event.type,
      event.target,
      event.subject_id ?? null,
      JSON.stringify(event.resource),
      event.payload === undefined || event.payload === null ? null : JSON.stringify(event.payload),
      event.notify ?? null,
    ],
  );
}

export function wireEvent(event: OutboxEvent): { type: string; resource: JsonValue; payload?: JsonValue } {
  return {
    type: event.type,
    resource: event.resource,
    ...(event.payload === null ? {} : { payload: event.payload }),
  };
}

/** Resolves the topic and rejects undeclared module channels or inactive modules. */
async function resolveTopic(db: QueryClient, event: OutboxEvent): Promise<string> {
  if (event.target === "admins" || event.target === "all") return event.target;
  if (event.target === "user") {
    if (!event.subject_id) throw new DomainError("validation_failed", "user event without subject");
    return `user-${event.subject_id}`;
  }
  if (!event.target.startsWith("channel:")) {
    throw new DomainError("validation_failed", "invalid event target");
  }
  const topic = event.target.slice("channel:".length);
  const { rows } = await db.query(
    `select 1
       from public.module_channels c
       join public.module_registry m on m.key = c.module_key
      where m.state = 'active'
        and c.module_key = $2
        and $1 ~ ('^' || regexp_replace(c.pattern, '\\{[a-z_]+\\}', '[0-9a-f-]{36}', 'g') || '$')`,
    [topic, event.module_key],
  );
  if (!rows[0]) throw new DomainError("validation_failed", "event channel is not active");
  return topic;
}

async function recipients(db: QueryClient, event: OutboxEvent): Promise<string[]> {
  let rows: Record<string, unknown>[];
  if (event.target === "admins") {
    ({ rows } = await db.query(
      `select distinct d.push_token from public.devices d
         join public.profiles p on p.id = d.user_id
        where p.role in ('admin', 'super_admin')
          and p.deactivated_at is null
          and d.push_token is not null and d.revoked_at is null`,
    ));
  } else if (event.target === "all") {
    ({ rows } = await db.query(
      `select distinct d.push_token from public.devices d
         join public.profiles p on p.id = d.user_id
        where p.deactivated_at is null
          and d.push_token is not null and d.revoked_at is null`,
    ));
  } else if (event.target === "user") {
    ({ rows } = await db.query(
      `select distinct d.push_token from public.devices d
         join public.profiles p on p.id = d.user_id
        where d.user_id = $1 and p.deactivated_at is null
          and d.push_token is not null and d.revoked_at is null`,
      [event.subject_id],
    ));
  } else {
    const topic = event.target.slice("channel:".length);
    const { rows: channels } = await db.query(
      `select c.members_fn from public.module_channels c
        join public.module_registry m on m.key = c.module_key
       where m.state = 'active'
         and c.module_key = $2
         and $1 ~ ('^' || regexp_replace(c.pattern, '\\{[a-z_]+\\}', '[0-9a-f-]{36}', 'g') || '$')
       limit 1`,
      [topic, event.module_key],
    );
    const fn = channels[0]?.members_fn;
    if (!fn || !/^[a-z][a-z0-9_]{0,62}$/.test(String(fn))) return [];
    try {
      ({ rows } = await db.query(
        `select distinct d.push_token
           from public.devices d
           join public.profiles p on p.id = d.user_id
          where p.deactivated_at is null
            and d.push_token is not null and d.revoked_at is null
            and d.user_id in (select member from public.${String(fn)}($1) as t(member))`,
        [topic],
      ));
    } catch {
      // A broken members_fn degrades push delivery instead of failing the event.
      rows = [];
    }
  }
  return rows.map((row) => String(row.push_token));
}

async function markPublished(db: QueryClient, eventId: string): Promise<void> {
  await db.query(
    `update public.event_outbox
        set state = 'published', published_at = now(), claimed_until = null
      where event_id = $1`,
    [eventId],
  );
}

async function markFailed(
  db: QueryClient,
  eventId: string,
  attempts: number,
  maxAttempts: number,
): Promise<void> {
  if (attempts >= maxAttempts) {
    await db.query(
      `update public.event_outbox
          set state = 'failed', failed_at = now(), claimed_until = null
        where event_id = $1`,
      [eventId],
    );
    return;
  }
  const delaySeconds = Math.min(60 * 60, 2 ** attempts * 15);
  await db.query(
    `update public.event_outbox
        set next_attempt_at = now() + ($2 || ' seconds')::interval, claimed_until = null
      where event_id = $1`,
    [eventId, String(delaySeconds)],
  );
}

export async function publishPending(
  deps: RealtimeDeps,
  limit = 20,
): Promise<{ published: number; retried: number; failed: number }> {
  const { rows } = await deps.db.query(
    `update public.event_outbox
        set claimed_until = now() + interval '60 seconds', attempts = attempts + 1
      where event_id in (
        select event_id from public.event_outbox
         where state = 'pending'
           and (next_attempt_at is null or next_attempt_at <= now())
           and (claimed_until is null or claimed_until < now())
         order by created_at asc
         limit $1
         for update skip locked
      )
      returning event_id, request_id, module_key, type, target, subject_id, resource,
                payload, notify, attempts, hook_applied`,
    [limit],
  );

  let published = 0;
  let retried = 0;
  let failed = 0;
  const maxAttempts = deps.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;

  for (const row of rows) {
    // `attempts` already includes the increment made by the claim above.
    const event = row as OutboxEvent;
    try {
      const topic = await resolveTopic(deps.db, event);
      if (!deps.realtime) throw new Error("realtime transport is not configured");
      await deps.realtime.publish(topic, wireEvent(event));

      if (deps.hooks) {
        const applied = await deps.hooks.run(event);
        const newlyApplied = applied.filter(
          (moduleKey) => !(event.hook_applied ?? []).includes(moduleKey),
        );
        if (newlyApplied.length > 0) {
          await deps.db.query(
            `update public.event_outbox
                set hook_applied = coalesce(hook_applied, '{}') || $2::text[]
              where event_id = $1`,
            [event.event_id, newlyApplied],
          );
        }
      }

      if (event.notify?.includes("push") && deps.push) {
        const tokens = await recipients(deps.db, event);
        if (tokens.length > 0) {
          const results = await deps.push.send(tokens, {
            key: `push.${event.type.replace(/\./g, "_")}`,
            payload: JSON.stringify(wireEvent(event)),
          });
          const invalid = results
            .filter((result) => result.error === "UNREGISTERED" || result.error === "INVALID_ARGUMENT")
            .map((result) => result.token);
          if (invalid.length > 0) {
            await deps.db.query(
              "update public.devices set revoked_at = now() where push_token = any($1::text[]) and revoked_at is null",
              [invalid],
            );
          }
          if (results.some((result) => result.error === "RETRY")) {
            throw new Error("push provider requested a retry");
          }
        }
      }

      await markPublished(deps.db, event.event_id);
      published += 1;
    } catch (err) {
      deps.logger?.({
        level: "warn",
        message: err instanceof Error ? err.message : String(err),
        eventId: event.event_id,
      });
      await markFailed(deps.db, event.event_id, event.attempts, maxAttempts);
      if (event.attempts >= maxAttempts) failed += 1;
      else retried += 1;
    }
  }

  return { published, retried, failed };
}
