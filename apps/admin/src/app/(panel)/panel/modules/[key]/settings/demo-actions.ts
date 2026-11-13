"use server";

import { revalidatePath } from "next/cache";
import { clearDemo, seedDemo, type DemoStatus } from "@027apps/core/demo/service.js";
import { demoRouteDeps } from "@/lib/demo-route-deps";
import { requirePanel } from "@/lib/panel-guard";

export type DemoActionState =
  | { ok: true; demo: DemoStatus }
  | { ok: false; reason: "forbidden" | "disabled" | "production" | "linked" | "failed" };

/**
 * Turns the Core error into something the card can render without leaking SQL.
 * `demo_linked` names the module in `details`, so the operator knows what to
 * clear first.
 */
function failureReason(error: unknown): DemoActionState {
  const details =
    typeof error === "object" && error !== null && "details" in error
      ? (error.details as Record<string, unknown> | undefined)
      : undefined;
  switch (details?.code) {
    case "demo_disabled":
      return { ok: false, reason: "disabled" };
    case "demo_in_production":
      return { ok: false, reason: "production" };
    case "demo_linked":
      return { ok: false, reason: "linked" };
    default:
      return { ok: false, reason: "failed" };
  }
}

/** Seeds the demo dataset. The panel gate is repeated: an action is a route. */
export async function seedDemoAction(): Promise<DemoActionState> {
  const gate = await requirePanel("admin");
  if ("denied" in gate) return { ok: false, reason: "forbidden" };
  try {
    const { demo } = await demoRouteDeps();
    const status = await seedDemo(demo);
    revalidatePath("/panel/modules", "layout");
    return { ok: true, demo: status };
  } catch (error) {
    return failureReason(error);
  }
}

/** Clears the demo dataset; refuses while a module still holds demo rows. */
export async function clearDemoAction(): Promise<DemoActionState> {
  const gate = await requirePanel("admin");
  if ("denied" in gate) return { ok: false, reason: "forbidden" };
  try {
    const { demo } = await demoRouteDeps();
    const status = await clearDemo(demo);
    revalidatePath("/panel/modules", "layout");
    return { ok: true, demo: status };
  } catch (error) {
    return failureReason(error);
  }
}
