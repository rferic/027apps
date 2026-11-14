import { withDoor } from "@027apps/core/api/door.js";
import { getInfra, runInTransaction } from "@/lib/api/door";
import type { OweDeps, OweError } from "@027apps/owe-no/domain/service.js";
import { OweDomainError } from "@027apps/owe-no/domain/service.js";
import { DomainError } from "@027apps/core/errors.js";

/** OweNo speaks through the door with its own module scopes, never Core roles. */
export async function oweDeps(): Promise<{
  door: Parameters<typeof withDoor>[2];
  auth: Parameters<typeof withDoor>[1]["auth"];
  owe: OweDeps;
  callerId: (caller: { kind: string; userId?: string }) => string;
}> {
  const { deps, auth, settingsDeps } = await getInfra();
  return {
    door: deps,
    auth,
    owe: { db: settingsDeps.db, withTransaction: runInTransaction },
    callerId(caller) {
      if (caller.kind === "session" || caller.kind === "delegated") return caller.userId!;
      throw new DomainError("insufficient_scope");
    },
  };
}

/**
 * Plain JSON at the door boundary. The domain returns typed views; the door's
 * `JsonValue` has no index signature for interfaces, so this is where the shape
 * is asserted instead of scattering casts through every route.
 */
export function json<T>(value: T): import("@027apps/core/api/types.js").JsonValue {
  return value as unknown as import("@027apps/core/api/types.js").JsonValue;
}

/** The module's domain error mapped to the Core envelope. */
export function domainError(error: unknown): never {
  if (error instanceof OweDomainError) {
    const status: Record<OweError, "not_found" | "validation_failed" | "conflict" | "insufficient_scope"> = {
      not_found: "not_found",
      forbidden: "insufficient_scope",
      validation_failed: "validation_failed",
      conflict: "conflict",
    };
    throw new DomainError(status[error.code], error.message, error.details);
  }
  throw error;
}
