import { describe, expect, it } from "vitest";
import {
  createGroupSchema,
  createTaskSchema,
  taskQuerySchema,
  updateTaskSchema,
} from "./schemas";

/** What the edge accepts before the domain counts characters (spec §6). */
describe("todo schemas", () => {
  it("accepts an emoji title and a power inside 1..5", () => {
    const parsed = createTaskSchema.parse({ title: "💡💡 Cambiar la bombilla", power: 5 });
    expect(parsed.title).toBe("💡💡 Cambiar la bombilla");
    expect(parsed.power).toBe(5);
  });

  it("refuses power outside the range, a bad date and unknown keys", () => {
    expect(() => createTaskSchema.parse({ title: "x", power: 6 })).toThrow();
    expect(() => createTaskSchema.parse({ title: "x", due_on: "27/11/2026" })).toThrow();
    expect(() => createTaskSchema.parse({ title: "x", group_id: "otro" })).toThrow();
  });

  it("keeps a periodic task without a due date in the caller's hands", () => {
    // The edge does not forbid it: the domain answers with a clear code.
    const parsed = createTaskSchema.parse({ title: "Regar", recurrence: "weekly" });
    expect(parsed.recurrence).toBe("weekly");
  });

  it("refuses an empty patch", () => {
    expect(() => updateTaskSchema.parse({})).toThrow(/nothing to update/);
  });

  it("coerces the list filters and rejects unknown query keys", () => {
    expect(taskQuerySchema.parse({ limit: "10", state: "done" })).toEqual({
      limit: 10,
      state: "done",
    });
    expect(() => taskQuerySchema.parse({ owner: "me" })).toThrow();
    expect(() => taskQuerySchema.parse({ limit: "500" })).toThrow();
  });

  it("only accepts the four power periods on a group", () => {
    expect(createGroupSchema.parse({ name: "🏠 Casa", power_period: "weekly" })).toMatchObject({
      power_period: "weekly",
    });
    expect(() => createGroupSchema.parse({ name: "Casa", power_period: "daily" })).toThrow();
  });
});
