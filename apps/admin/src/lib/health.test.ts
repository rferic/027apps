import { describe, expect, it, vi, type Mock } from "vitest";
import { healthResponse, probeDatabase, type DatabasePort } from "./health";

interface FakeClient {
  query: Mock<(sql: string) => Promise<unknown>>;
  release: Mock<(destroy?: boolean) => void>;
}

function fakeClient(
  queryImpl: (sql: string) => Promise<unknown> = async () => ({ rows: [{ "?column?": 1 }] }),
): FakeClient {
  return { query: vi.fn(queryImpl), release: vi.fn<(destroy?: boolean) => void>() };
}

function fakePort(client: FakeClient): { connect: Mock<() => Promise<FakeClient>> } {
  return { connect: vi.fn(async () => client) };
}

describe("healthResponse", () => {
  it("reports ok without caching", async () => {
    const response = healthResponse(true);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: "ok" });
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("reports degraded without leaking internals", async () => {
    const response = healthResponse(false);

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ status: "degraded" });
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
});

describe("probeDatabase", () => {
  it("runs a trivial query and releases the client", async () => {
    const client = fakeClient();
    const port = fakePort(client);

    await expect(probeDatabase(port)).resolves.toBe(true);

    expect(client.query).toHaveBeenCalledWith("select 1");
    expect(client.release).toHaveBeenCalledWith(false);
  });

  it("reports unhealthy and releases when the query fails", async () => {
    const client = fakeClient(async () => {
      throw new Error("connection refused");
    });
    const port = fakePort(client);

    await expect(probeDatabase(port)).resolves.toBe(false);
    expect(client.release).toHaveBeenCalledWith(true);
  });

  it("reports unhealthy when the connection cannot be acquired", async () => {
    const port: DatabasePort = {
      connect: async () => {
        throw new Error("pool exhausted");
      },
    };

    await expect(probeDatabase(port)).resolves.toBe(false);
  });

  it("gives up when the database does not answer in time", async () => {
    vi.useFakeTimers();
    try {
      const client = fakeClient(() => new Promise(() => undefined));
      const pending = probeDatabase(fakePort(client), 50);

      await vi.advanceTimersByTimeAsync(60);

      await expect(pending).resolves.toBe(false);
      expect(client.release).toHaveBeenCalledWith(true);
    } finally {
      vi.useRealTimers();
    }
  });
});
