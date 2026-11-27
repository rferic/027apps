/**
 * The notification kinds a device can silence (sprint 17, task 02).
 *
 * An event name is not a user-facing kind: `owe_no.movement_updated` and
 * `owe_no.movement_deleted` share the "edited or deleted" switch. The Core owns
 * the catalog so the sender, the API and the app agree on the same keys.
 */
export type NotificationKind =
  | "invitation.requested"
  | "invitation.request_resolved"
  | "owe_no.movement_created"
  | "owe_no.movement_changed";

export interface NotificationType {
  key: NotificationKind;
  /** `null` for the Core's own notifications, which belong to no module. */
  module: string | null;
}

export const NOTIFICATION_TYPES: readonly NotificationType[] = [
  { key: "invitation.requested", module: null },
  { key: "invitation.request_resolved", module: null },
  { key: "owe_no.movement_created", module: "owe-no" },
  { key: "owe_no.movement_changed", module: "owe-no" },
];

/**
 * Outbox event type → kind. Anything missing here is not mappable: the sender
 * leaves it untouched (a new module's push is never silenced by accident) and
 * the API refuses to store a mute for it.
 */
const EVENT_KIND: Readonly<Record<string, NotificationKind>> = {
  "invitation.requested": "invitation.requested",
  "invitation.request_resolved": "invitation.request_resolved",
  "owe_no.movement_created": "owe_no.movement_created",
  "owe_no.movement_updated": "owe_no.movement_changed",
  "owe_no.movement_deleted": "owe_no.movement_changed",
};

export function notificationKind(eventType: string): NotificationKind | null {
  return EVENT_KIND[eventType] ?? null;
}

export function isNotificationKind(value: string): value is NotificationKind {
  return NOTIFICATION_TYPES.some((type) => type.key === value);
}
