import { describe, expect, it } from "vitest";
import { NOTIFICATION_TYPES, isNotificationKind, notificationKind } from "./catalog";

describe("notification catalog", () => {
  it("collapses updated and deleted movements into one kind", () => {
    expect(notificationKind("owe_no.movement_updated")).toBe("owe_no.movement_changed");
    expect(notificationKind("owe_no.movement_deleted")).toBe("owe_no.movement_changed");
    expect(notificationKind("owe_no.movement_created")).toBe("owe_no.movement_created");
  });

  it("groups the NotNow events into four switches", () => {
    expect(notificationKind("todo.task_created_assigned")).toBe("todo.task");
    expect(notificationKind("todo.task_completed")).toBe("todo.task");
    expect(notificationKind("todo.task_overdue_assigned")).toBe("todo.overdue");
    expect(notificationKind("todo.task_missed_period")).toBe("todo.overdue");
    expect(notificationKind("todo.task_missed_period_assigned")).toBe("todo.overdue");
    expect(notificationKind("todo.request_resolved")).toBe("todo.request");
    expect(notificationKind("todo.season_closed")).toBe("todo.season");
    expect(
      NOTIFICATION_TYPES.filter((type) => type.module === "todo").map((type) => type.key),
    ).toEqual(["todo.task", "todo.overdue", "todo.request", "todo.season"]);
  });

  it("leaves an unknown event unsilenceable", () => {
    expect(notificationKind("fixture.created")).toBeNull();
    expect(isNotificationKind("fixture.created")).toBe(false);
  });

  it("keeps every kind either general or owned by a module", () => {
    expect(NOTIFICATION_TYPES.filter((type) => type.module === null)).toHaveLength(2);
    expect(
      NOTIFICATION_TYPES.filter((type) => type.module === "owe-no").map((type) => type.key),
    ).toEqual(["owe_no.movement_created", "owe_no.movement_changed"]);
  });

  it("has no duplicate keys", () => {
    const keys = NOTIFICATION_TYPES.map((type) => type.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
