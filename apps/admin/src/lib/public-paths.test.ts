import { describe, expect, it } from "vitest";
import { isPublicPath } from "./public-paths";

describe("isPublicPath", () => {
  it.each([
    "/",
    "/self-host",
    "/self-host/",
    "/robots.txt",
    "/sitemap.xml",
    "/l/es",
    "/l/es/",
    "/l/de/self-host",
    "/l/pt/self-host/",
    "/help",
    "/help/firebase",
    "/help/firebase/",
    "/invite/027_inv_abc123",
    "/invite/027_inv_abc123/",
  ])("allows %s", (pathname) => {
    expect(isPublicPath(pathname)).toBe(true);
  });

  it.each([
    "/setup",
    "/login",
    "/members",
    "/helpful",
    "/help/other",
    "/help/firebase/secret",
    "/invite",
    "/invite/",
    "/invite/a/b",
    "/invites/x",
    "/invite/..",
    "/invite/../members",
    "/l/en",
    "/l/xx",
    "/l/es/panel",
    "/l",
  ])("does not expose %s", (pathname) => {
    expect(isPublicPath(pathname)).toBe(false);
  });
});
