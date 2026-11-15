import { demoStatus } from "@027apps/core/demo/service.js";
import type { DemoStatus } from "@027apps/core/demo/service.js";
import { demoRouteDeps } from "@/lib/demo-route-deps";

/**
 * Demo status for a panel render. `null` means the capability is off (or the
 * read failed): the card is then simply not shown, never an error page.
 */
export async function loadDemoStatus(): Promise<DemoStatus | null> {
  try {
    const deps = await demoRouteDeps();
    return await demoStatus(deps.demo);
  } catch {
    return null;
  }
}
