import { describe, expect, it } from "vitest";
import { createMemberInvitationSchema } from "./api";

describe("createMemberInvitationSchema", () => {
  it("accepts an absent body as an empty one", () => {
    expect(createMemberInvitationSchema.safeParse(undefined).success).toBe(true);
    expect(createMemberInvitationSchema.safeParse({}).success).toBe(true);
  });

  it("rejects anything the endpoint does not define", () => {
    expect(createMemberInvitationSchema.safeParse({ role: "admin" }).success).toBe(false);
  });
});
