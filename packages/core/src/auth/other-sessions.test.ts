import { describe, expect, it } from "vitest";
import type { Caller } from "../api/types";
import type { QueryClient } from "../api/rate-limit-storage";
import { revokeOtherSessions } from "./other-sessions";

const SESSION: Caller = { kind: "session", userId: "u-1", role: "user" };
const KEEP = "9b0b1c2e-3d4f-4a5b-8c6d-7e8f90123456";

function fakeDb(options: { ownedByCaller?: boolean; revoked?: number } = {}) {
  const calls: { sql: string; params: unknown[] }[] = [];
  const db: QueryClient = {
    async query(sql: string, params: unknown[] = []) {
      calls.push({ sql, params });
      if (sql.includes("select id from auth.sessions")) {
        return { rows: options.ownedByCaller === false ? [] : [{ id: KEEP }] };
      }
      if (sql.includes("delete from auth.sessions")) {
        return { rows: Array.from({ length: options.revoked ?? 2 }, (_, i) => ({ id: `s-${i}` })) };
      }
      return { rows: [] };
    },
  };
  return { db, calls };
}

describe("revokeOtherSessions", () => {
  it("deletes every session of the caller except the one asking", async () => {
    const { db, calls } = fakeDb();

    await expect(revokeOtherSessions({ db }, SESSION, KEEP)).resolves.toEqual({ revoked: 2 });

    const del = calls.find((call) => call.sql.includes("delete from auth.sessions"));
    expect(del?.sql).toContain("user_id = $1");
    expect(del?.sql).toContain("id <> $2");
    expect(del?.params).toEqual(["u-1", KEEP]);
  });

  it("only accepts a session caller", async () => {
    await expect(
      revokeOtherSessions({ db: fakeDb().db }, { kind: "anon" } as Caller, KEEP),
    ).rejects.toMatchObject({ code: "insufficient_scope" });
  });

  it("refuses a session id that is not the caller's", async () => {
    await expect(
      revokeOtherSessions({ db: fakeDb({ ownedByCaller: false }).db }, SESSION, KEEP),
    ).rejects.toMatchObject({ code: "not_found" });
  });
});
