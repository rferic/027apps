import { describe, expect, it } from "vitest";
import { slugConflictError } from "./panel-errors";

describe("slugConflictError", () => {
  it("names the slug as the cause of a create conflict", () => {
    expect(slugConflictError({ code: "conflict" }, {})).toBe(
      "A category with that slug already exists.",
    );
  });

  it("leaves other failures to the generic alert", () => {
    expect(slugConflictError({ code: "internal" }, {})).toBeUndefined();
    expect(slugConflictError({}, {})).toBeUndefined();
    expect(slugConflictError(null, {})).toBeUndefined();
  });
});
