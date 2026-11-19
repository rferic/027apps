import { describe, expect, it, vi } from "vitest";
import type { QueryClient } from "../api/rate-limit-storage.js";
import { publishPending, type PushPort, type RealtimePort } from "./service.js";

/**
 * The push data map (sprint 18, task 5): a `state` and a seat count `places`
 * flow through, but a plain `amount` never becomes a money field. The app
 * renders `key` + `state` as fixed localized text and pulls the detail from
 * the API when opened.
 */

interface RecordedQuery {
  sql: string;
  params: unknown[];
}

function fakeDb(handlers: Record<string, (params: unknown[]) => unknown[]>): {
  db: QueryClient;
  queries: RecordedQuery[];
} {
  const queries: RecordedQuery[] = [];
  const db: QueryClient = {
    async query(sql: string, params: unknown[] = []) {
      queries.push({ sql, params });
      for (const [needle, respond] of Object.entries(handlers)) {
        if (sql.includes(needle)) {
          return { rows: respond(params) as Record<string, unknown>[] };
        }
      }
      return { rows: [] };
    },
  };
  return { db, queries };
}

function claimedEvent(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    event_id: "e-1",
    request_id: null,
    module_key: null,
    type: "invitation.request_resolved",
    target: "user",
    subject_id: "u-1",
    resource: { request_id: "req-1", state: "approved", amount: 3, places: 3 },
    payload: null,
    notify: ["push"],
    attempts: 1,
    hook_applied: null,
    ...overrides,
  };
}

function realtimePort(): RealtimePort {
  return { publish: vi.fn().mockResolvedValue(undefined) };
}

function pushPort(): PushPort {
  return { send: vi.fn().mockResolvedValue([]) };
}

describe("push data map", () => {
  it("sends push with key and state, and never an amount", async () => {
    const realtime = realtimePort();
    const push = pushPort();
    const { db } = fakeDb({
      "set claimed_until = now()": () => [claimedEvent()],
      "select distinct d.push_token": () => [{ push_token: "tok-1" }],
      "set state = 'published'": () => [],
    });

    const result = await publishPending({ db, realtime, push }, 20);

    expect(result.published).toBe(1);
    expect(push.send).toHaveBeenCalledTimes(1);
    const [tokens, data] = (push.send as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string[],
      Record<string, string>,
    ];
    expect(tokens).toEqual(["tok-1"]);
    expect(data.key).toBe("push.invitation_request_resolved");
    expect(data.module).toBe("027apps");
    expect(data.state).toBe("approved");
    // The resource carries a plain seat `amount`, never a money `amount_minor`;
    // the push map must not surface it as `amount`.
    expect(data).not.toHaveProperty("amount");
  });

  it("forwards a seat count as places, not as money", async () => {
    const realtime = realtimePort();
    const push = pushPort();
    const { db } = fakeDb({
      "set claimed_until = now()": () => [
        claimedEvent({
          type: "invitation.requested",
          target: "admins",
          subject_id: null,
          resource: { request_id: "req-1", actor_name: "Eric", amount: 5, places: 5, remaining: 0 },
        }),
      ],
      "select distinct d.push_token": () => [{ push_token: "tok-1" }],
      "set state = 'published'": () => [],
    });

    await publishPending({ db, realtime, push }, 20);

    const [, data] = (push.send as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string[],
      Record<string, string>,
    ];
    expect(data.key).toBe("push.invitation_requested");
    expect(data.actor).toBe("Eric");
    expect(data.places).toBe("5");
    expect(data).not.toHaveProperty("amount");
  });
});
