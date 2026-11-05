import { describe, expect, it } from "vitest";
import type { ClientBase } from "pg";
import { createTestUser, query, withClient } from "../pg.js";
import { enqueueEvent, publishPending, wireEvent, type RealtimeDeps } from "@027apps/core/realtime/service.js";

const email = (name: string) => `rt-${name}-${Date.now()}-${Math.random()}@test.local`;

async function inRollback(fn: (c: ClientBase) => Promise<void>): Promise<void> {
  await withClient(async (c) => {
    await c.query("BEGIN");
    await query(c, "delete from public.event_outbox");
    try {
      await fn(c);
    } finally {
      await c.query("ROLLBACK");
    }
  });
}

async function user(c: ClientBase, role: "admin" | "user" = "user") {
  return createTestUser(c, { email: email(role), role });
}

describe("event outbox", () => {
  it("enqueues and publishes the wire envelope without target metadata", async () => {
    await inRollback(async (c) => {
      const who = await user(c);
      const messages: { topic: string; message: unknown }[] = [];
      const deps: RealtimeDeps = {
        db: { query: (sql: string, params: unknown[] = []) => query(c, sql, params) },
        realtime: {
          publish: async (topic, message) => {
            messages.push({ topic, message });
          },
        },
      };

      await enqueueEvent(deps.db, {
        type: "user.deactivated",
        target: "user",
        subject_id: who.id,
        resource: { id: who.id, display_name: "User" },
        payload: { reason: "test" },
      });

      const result = await publishPending(deps);
      expect(result).toEqual({ published: 1, retried: 0, failed: 0 });
      expect(messages).toHaveLength(1);
      expect(messages[0]!.topic).toBe(`user-${who.id}`);
      expect(messages[0]!.message).toEqual({
        type: "user.deactivated",
        resource: { id: who.id, display_name: "User" },
        payload: { reason: "test" },
      });
      expect(messages[0]!.message).not.toHaveProperty("target");

      const { rows } = await query(c, "select state, published_at from public.event_outbox");
      expect(rows[0]).toMatchObject({ state: "published" });
      expect(rows[0]!.published_at).not.toBeNull();

      // A published event is never claimed again.
      expect(await publishPending(deps)).toEqual({ published: 0, retried: 0, failed: 0 });
    });
  });

  it("sends push to the subject's devices only and revokes invalid tokens", async () => {
    await inRollback(async (c) => {
      const who = await user(c);
      const other = await user(c);
      await query(c, "insert into public.devices (user_id, platform, push_token) values ($1, 'android', 'fcm-subject')", [who.id]);
      await query(c, "insert into public.devices (user_id, platform, push_token) values ($1, 'android', 'fcm-other')", [other.id]);

      const sent: string[] = [];
      const deps: RealtimeDeps = {
        db: { query: (sql: string, params: unknown[] = []) => query(c, sql, params) },
        realtime: { publish: async () => {} },
        push: {
          send: async (tokens) => {
            sent.push(...tokens);
            return tokens.map((token) => ({ token, error: token === "fcm-subject" ? ("UNREGISTERED" as const) : undefined }));
          },
        },
      };

      await enqueueEvent(deps.db, {
        type: "invitation.redeemed",
        target: "user",
        subject_id: who.id,
        resource: { id: "inv-1" },
        notify: ["push"],
      });
      await publishPending(deps);

      expect(sent).toEqual(["fcm-subject"]);
      const { rows } = await query(c, "select revoked_at from public.devices where push_token = 'fcm-subject'");
      expect(rows[0]!.revoked_at).not.toBeNull();
      const { rows: otherDevice } = await query(c, "select revoked_at from public.devices where push_token = 'fcm-other'");
      expect(otherDevice[0]!.revoked_at).toBeNull();
    });
  });

  it("retries with backoff and marks failed after the attempt budget", async () => {
    await inRollback(async (c) => {
      const deps: RealtimeDeps = {
        db: { query: (sql: string, params: unknown[] = []) => query(c, sql, params) },
        realtime: { publish: async () => { throw new Error("transport down"); } },
        maxAttempts: 2,
      };

      await enqueueEvent(deps.db, {
        type: "module.installed",
        target: "admins",
        resource: { key: "demo" },
      });

      expect(await publishPending(deps)).toEqual({ published: 0, retried: 1, failed: 0 });
      const { rows: first } = await query(c, "select state, attempts, next_attempt_at from public.event_outbox");
      expect(first[0]).toMatchObject({ state: "pending", attempts: 1 });
      expect(first[0]!.next_attempt_at).not.toBeNull();

      await query(c, "update public.event_outbox set next_attempt_at = now() - interval '1 second'");
      expect(await publishPending(deps)).toEqual({ published: 0, retried: 0, failed: 1 });
      const { rows: second } = await query(c, "select state, failed_at from public.event_outbox");
      expect(second[0]!.state).toBe("failed");
      expect(second[0]!.failed_at).not.toBeNull();
    });
  });

  it("rejects an undeclared channel and a bad target", async () => {
    await inRollback(async (c) => {
      const deps: RealtimeDeps = {
        db: { query: (sql: string, params: unknown[] = []) => query(c, sql, params) },
        realtime: { publish: async () => {} },
      };
      await expect(
        enqueueEvent(deps.db, { type: "x", target: "user", resource: {} }),
      ).rejects.toMatchObject({ code: "validation_failed" });

      await enqueueEvent(deps.db, {
        type: "expense.created",
        target: `channel:expense-group-${crypto.randomUUID()}`,
        resource: { id: "1" },
      });
      const result = await publishPending(deps);
      expect(result.published).toBe(0);
      const { rows } = await query(c, "select state from public.event_outbox");
      expect(rows[0]!.state).toBe("pending");
    });
  });

  it("fails closed when the realtime transport is not configured", async () => {
    await inRollback(async (c) => {
      const deps: RealtimeDeps = {
        db: { query: (sql: string, params: unknown[] = []) => query(c, sql, params) },
      };
      await enqueueEvent(deps.db, { type: "settings.updated", target: "admins", resource: {} });
      expect(await publishPending(deps)).toEqual({ published: 0, retried: 1, failed: 0 });
      expect(wireEvent({ type: "x", target: "admins", resource: { a: 1 }, payload: null, event_id: "1", request_id: null, module_key: null, subject_id: null, attempts: 0, notify: null })).toEqual({
        type: "x",
        resource: { a: 1 },
      });
    });
  });
});
