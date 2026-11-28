import { describe, expect, it, vi } from "vitest";
import type { QueryClient } from "../api/rate-limit-storage.js";
import { publishPending, type PushPort, type RealtimePort } from "./service.js";

/**
 * The push data map (sprint 18, task 5): an `invitation.*` push carries
 * `key`/`module`, `state` for the resolved event and the seat count as
 * `seats` — never a name and never `amount`, which the app renders as money
 * (spec §10/R5, revised after the QA round). Business events (owe-no) keep
 * their description/group/actor/amount/currency unchanged.
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

/** Runs one claimed event through `publishPending` and returns the push data. */
async function pushDataFor(
  event: Record<string, unknown>,
): Promise<{ realtime: RealtimePort; push: PushPort; data: Record<string, string> }> {
  const realtime = realtimePort();
  const push = pushPort();
  const { db } = fakeDb({
    "set claimed_until = now()": () => [event],
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
  return { realtime, push, data };
}

describe("push data map", () => {
  it("invitation.request_resolved sends key, module, state and the seat count", async () => {
    const { data } = await pushDataFor(claimedEvent());

    expect(data).toEqual({
      key: "push.invitation_request_resolved",
      module: "027apps",
      state: "approved",
      seats: "3",
    });
    expect(data).not.toHaveProperty("amount");
    expect(data).not.toHaveProperty("places");
    expect(data).not.toHaveProperty("actor");
    expect(data).not.toHaveProperty("description");
  });

  it("invitation.requested names the seat count, never a name or a money amount", async () => {
    const { data } = await pushDataFor(
      claimedEvent({
        type: "invitation.requested",
        target: "admins",
        subject_id: null,
        resource: { request_id: "req-1", actor_name: "Eric", amount: 5, places: 5, level: 1, remaining: 0 },
      }),
    );

    expect(data).toEqual({
      key: "push.invitation_requested",
      module: "027apps",
      seats: "5",
    });
    expect(data).not.toHaveProperty("actor");
    expect(data).not.toHaveProperty("places");
    expect(data).not.toHaveProperty("amount");
    expect(data).not.toHaveProperty("description");
  });

  it("keeps description, actor and amount for a non-invitation push", async () => {
    const { data } = await pushDataFor(
      claimedEvent({
        type: "expense.created",
        resource: {
          description: "Dinner",
          actor_name: "Ada",
          amount_minor: 1000,
          currency: "EUR",
        },
      }),
    );

    expect(data.key).toBe("push.expense_created");
    expect(data.module).toBe("027apps");
    expect(data).toMatchObject({
      description: "Dinner",
      actor: "Ada",
      amount: "1000",
      currency: "EUR",
    });
  });

  it("carries the request id an actionable notification answers against", async () => {
    const { data } = await pushDataFor(
      claimedEvent({
        type: "todo.request_created",
        module_key: "todo",
        target: "user",
        subject_id: "u-2",
        resource: {
          request_id: "req-9",
          task_id: "task-1",
          description: "Sacar la basura",
          group_name: "Casa",
          actor_name: "Luis",
          group_id: "g-1",
        },
      }),
    );

    expect(data).toMatchObject({
      key: "push.todo_request_created",
      module: "todo",
      description: "Sacar la basura",
      group: "Casa",
      actor: "Luis",
      target: "g-1",
      request_id: "req-9",
    });
  });
});
