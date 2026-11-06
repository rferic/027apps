import { describe, expect, it } from "vitest";
import { isPublicHelpPath } from "./public-paths";

describe("isPublicHelpPath", () => {
  it.each(["/help", "/help/firebase", "/help/firebase/"])("allows %s", (pathname) => {
    expect(isPublicHelpPath(pathname)).toBe(true);
  });

  it.each(["/", "/setup", "/login", "/helpful", "/help/other", "/help/firebase/secret"])(
    "does not expose %s",
    (pathname) => {
      expect(isPublicHelpPath(pathname)).toBe(false);
    },
  );
});
