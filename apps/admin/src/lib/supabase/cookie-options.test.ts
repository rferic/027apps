import { describe, expect, it } from "vitest";
import { SESSION_COOKIE_OPTIONS } from "./cookie-options";

describe("SESSION_COOKIE_OPTIONS", () => {
  it("keeps the session cookie out of client JavaScript and cross-site posts", () => {
    expect(SESSION_COOKIE_OPTIONS).toMatchObject({
      path: "/",
      sameSite: "lax",
      httpOnly: true,
    });
  });

  it("marks the cookie Secure in production only (local HTTP still works)", () => {
    expect(SESSION_COOKIE_OPTIONS.secure).toBe(process.env.NODE_ENV === "production");
  });
});
