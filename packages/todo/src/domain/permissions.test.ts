import { describe, expect, it } from "vitest";
import {
  canCompleteTask,
  canDeleteTask,
  canEditTask,
  canManageGroup,
  canReleaseTask,
  canRequestTask,
  canReopenTask,
  charLength,
  groupName,
  groupPower,
  taskTitle,
} from "./permissions.js";

/** The stable error code, which is what the API maps to a status. */
const codeOf = (fn: () => unknown): string => {
  try {
    fn();
    return "none";
  } catch (error) {
    return (error as { code?: string }).code ?? "unknown";
  }
};

const task = (over: Partial<{ assigneeId: string | null; state: "pending" | "done" }> = {}) => ({
  assigneeId: null as string | null,
  state: "pending" as "pending" | "done",
  ...over,
});

describe("character counting", () => {
  it("counts an emoji as one character, not two UTF-16 units", () => {
    expect("🏠".length).toBe(2);
    expect(charLength("🏠")).toBe(1);
    expect(charLength("🏠 Casa")).toBe(6);
  });
});

describe("titles", () => {
  it("accepts emoji inside the text and trims the edges", () => {
    expect(groupName("  🏠 Casa  ")).toBe("🏠 Casa");
    expect(taskTitle("💡💡 Cambiar la bombilla")).toBe("💡💡 Cambiar la bombilla");
  });

  it("refuses an empty one", () => {
    expect(codeOf(() => groupName("   "))).toBe("validation_failed");
    expect(codeOf(() => taskTitle(""))).toBe("validation_failed");
  });

  it("counts the limit by code points", () => {
    const sixty = "🏠".repeat(60);
    const hundredTwenty = "💡".repeat(120);
    expect(groupName(sixty)).toBe(sixty);
    expect(taskTitle(hundredTwenty)).toBe(hundredTwenty);
    expect(codeOf(() => groupName(`${sixty}🏠`))).toBe("validation_failed");
    expect(codeOf(() => taskTitle(`${hundredTwenty}💡`))).toBe("validation_failed");
  });
});

describe("a task with no holder", () => {
  const free = task();

  it("is edited and deleted by any member", () => {
    expect(canEditTask("ana", free)).toBe(true);
    expect(canEditTask("luis", free)).toBe(true);
    expect(canDeleteTask("luis", free)).toBe(true);
  });

  it("is not completed until somebody takes it", () => {
    expect(canCompleteTask("ana", free)).toBe(false);
    expect(canReleaseTask("ana", free)).toBe(false);
  });

  it("is not requested: there is nobody to ask", () => {
    expect(canRequestTask("ana", free)).toBe(false);
  });
});

describe("a task somebody holds", () => {
  const held = task({ assigneeId: "ana" });

  it("is edited, completed, released and deleted only by its holder", () => {
    expect(canEditTask("ana", held)).toBe(true);
    expect(canCompleteTask("ana", held)).toBe(true);
    expect(canReleaseTask("ana", held)).toBe(true);
    expect(canDeleteTask("ana", held)).toBe(true);

    expect(canEditTask("luis", held)).toBe(false);
    expect(canCompleteTask("luis", held)).toBe(false);
    expect(canReleaseTask("luis", held)).toBe(false);
    expect(canDeleteTask("luis", held)).toBe(false);
  });

  it("is requested by anybody but its holder", () => {
    expect(canRequestTask("luis", held)).toBe(true);
    expect(canRequestTask("ana", held)).toBe(false);
  });
});

describe("a task already done", () => {
  const done = task({ assigneeId: "ana", state: "done" });

  it("cannot be edited, completed or deleted", () => {
    expect(canEditTask("ana", done)).toBe(false);
    expect(canCompleteTask("ana", done)).toBe(false);
    expect(canDeleteTask("ana", done)).toBe(false);
  });

  it("is reopened only by its holder", () => {
    expect(canReopenTask("ana", done)).toBe(true);
    expect(canReopenTask("luis", done)).toBe(false);
  });
});

describe("group management", () => {
  it("belongs to the owner alone", () => {
    expect(canManageGroup("ana", { ownerId: "ana" })).toBe(true);
    expect(canManageGroup("luis", { ownerId: "ana" })).toBe(false);
  });

  it("never gives power to a personal folder", () => {
    expect(codeOf(() => groupPower("personal", true, "weekly"))).toBe("personal_group");
    expect(groupPower("personal", false, "infinite")).toEqual({
      powerEnabled: false,
      powerPeriod: "infinite",
    });
    expect(groupPower("group", true, "weekly")).toEqual({
      powerEnabled: true,
      powerPeriod: "weekly",
    });
  });
});
