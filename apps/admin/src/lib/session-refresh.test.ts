import { describe, expect, it } from "vitest";
import { classifyRefreshError } from "./session-refresh";

describe("classifyRefreshError", () => {
  it("treats a missing or revoked refresh token as invalid", () => {
    expect(classifyRefreshError({ code: "refresh_token_not_found" })).toBe("invalid");
    expect(classifyRefreshError({ code: "invalid_grant" })).toBe("invalid");
    expect(classifyRefreshError({ code: "session_not_found" })).toBe("invalid");
    expect(classifyRefreshError({ name: "AuthSessionMissingError" })).toBe("invalid");
  });

  it("treats a 400/401/403 as invalid", () => {
    expect(classifyRefreshError({ status: 400 })).toBe("invalid");
    expect(classifyRefreshError({ statusCode: 401 })).toBe("invalid");
    expect(classifyRefreshError({ status: 403 })).toBe("invalid");
  });

  it("keeps the session on a network, timeout, 429 or 5xx failure", () => {
    expect(classifyRefreshError(new TypeError("fetch failed"))).toBe("unavailable");
    expect(classifyRefreshError({ name: "AbortError" })).toBe("unavailable");
    expect(classifyRefreshError({ name: "AuthRetryableFetchError" })).toBe("unavailable");
    expect(classifyRefreshError({ status: 429 })).toBe("unavailable");
    expect(classifyRefreshError({ status: 500 })).toBe("unavailable");
    expect(classifyRefreshError("boom")).toBe("unavailable");
    expect(classifyRefreshError(undefined)).toBe("unavailable");
  });
});
