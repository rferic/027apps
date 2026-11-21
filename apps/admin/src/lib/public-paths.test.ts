import { describe, expect, it } from "vitest";
import { isPublicPath } from "./public-paths";

describe("isPublicPath", () => {
  it.each([
    "/",
    "/self-host",
    "/self-host/",
    "/robots.txt",
    "/sitemap.xml",
    "/cookies",
    "/cookies/",
    "/help",
    "/help/firebase",
    "/help/firebase/",
    "/invite/027_inv_abc123",
    "/invite/027_inv_abc123/",
    "/migrate/027_mig_abc123",
    "/migrate/027_mig_abc123/",
    "/join/027_join_abc123",
    "/join/027_join_abc123/",
    "/forgot-password",
    "/auth/confirm",
  ])("allows %s", (pathname) => {
    expect(isPublicPath(pathname)).toBe(true);
  });

  it.each([
    "/setup",
    "/login",
    "/panel/members",
    "/helpful",
    "/help/other",
    "/help/firebase/secret",
    "/invite",
    "/invite/",
    "/invite/a/b",
    "/invites/x",
    "/invite/..",
    "/invite/../panel/members",
    "/migrate",
    "/migrate/",
    "/migrate/a/b",
    "/migrate/..",
    "/join",
    "/join/",
    "/join/a/b",
    "/join/..",
  ])("does not expose %s", (pathname) => {
    expect(isPublicPath(pathname)).toBe(false);
  });
});
