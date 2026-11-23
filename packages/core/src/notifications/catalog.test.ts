import { describe, expect, it } from "vitest";
import {
  NOTIFICATION_TYPES,
  isNotificationKind,
  notificationKind,
  notificationKindsOf,
} from "./catalog";

describe("notification catalog", () => {
  it("collapses updated and deleted movements into one kind", () => {
    expect(notificationKind("owe_no.movement_updated")).toBe("owe_no.movement_changed");
    expect(notificationKind("owe_no.movement_deleted")).toBe("owe_no.movement_changed");
    expect(notificationKind("owe_no.movement_created")).toBe("owe_no.movement_created");
  });

  it("leaves an unknown event unsilenceable", () => {
    expect(notificationKind("fixture.created")).toBeNull();
    expect(isNotificationKind("fixture.created")).toBe(false);
  });

  it("keeps every kind either general or owned by a module", () => {
    expect(NOTIFICATION_TYPES.filter((type) => type.module === null)).toHaveLength(2);
    expect(notificationKindsOf("owe-no")).toEqual([
      "owe_no.movement_created",
      "owe_no.movement_changed",
    ]);
  });

  it("has no duplicate keys", () => {
    const keys = NOTIFICATION_TYPES.map((type) => type.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
