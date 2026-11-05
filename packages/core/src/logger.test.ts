import { describe, expect, it } from "vitest";
import { serializeLog, type LogEntry } from "./logger.js";

const base: LogEntry = {
  ts: "2026-11-05T10:00:00.000Z",
  level: "info",
  msg: "request completed",
};

describe("serializeLog", () => {
  it("emits one JSON line with stable key order", () => {
    const line = serializeLog({
      ...base,
      request_id: "r1",
      route: "/api/v1/instance",
      status: 200,
      duration_ms: 12,
      actor: "session:u1",
      code: "ok",
    });

    expect(line).toBe(
      '{"ts":"2026-11-05T10:00:00.000Z","level":"info","msg":"request completed","request_id":"r1","route":"/api/v1/instance","status":200,"duration_ms":12,"actor":"session:u1","code":"ok"}',
    );
  });

  it("escapes newlines instead of breaking the line", () => {
    const line = serializeLog({ ...base, msg: "line one\nline two" });
    expect(line).not.toContain("\n");
    expect(line).toContain("line one\\nline two");
  });

  it("never serializes unknown fields (email, ip, body, tokens)", () => {
    const dirty = {
      ...base,
      email: "admin@example.com",
      ip: "1.2.3.4",
      body: { password: "x" },
      token: "secret",
    } as unknown as LogEntry;

    const line = serializeLog(dirty);

    expect(line).not.toContain("admin@example.com");
    expect(line).not.toContain("1.2.3.4");
    expect(line).not.toContain("secret");
    expect(line).not.toContain("password");
  });

  it("serializes status and duration_ms as numbers", () => {
    const line = serializeLog({ ...base, status: 503, duration_ms: 30 });
    expect(line).toContain('"status":503');
    expect(line).toContain('"duration_ms":30');
  });
});
