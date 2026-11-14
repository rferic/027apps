"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { MODULE_KEY } from "@027apps/core/modules/manifest.js";
import { installModule, type InstallFailureReason } from "@/lib/module-install";
import { requirePanel } from "@/lib/panel-guard";

/** Only a failure returns to the client: success always redirects. */
export interface InstallActionState {
  ok: false;
  reason: InstallFailureReason;
  requestId?: string;
}

/** The key is the only input and it crosses the wire, so it is validated here. */
const installSchema = z.object({ key: z.string().max(64).regex(MODULE_KEY) }).strict();

/**
 * Installs a trusted package and opens its detail page. The panel gate is
 * repeated because a server action is callable outside the page render; the
 * Core guards `modules:manage` again on the in-process route (ADR 0004).
 */
export async function installModuleAction(key: string): Promise<InstallActionState> {
  const gate = await requirePanel("admin");
  if ("denied" in gate) return { ok: false, reason: "forbidden" };

  const parsed = installSchema.safeParse({ key });
  if (!parsed.success) return { ok: false, reason: "failed" };

  const result = await installModule(parsed.data.key);
  if (!result.ok) {
    return {
      ok: false,
      reason: result.reason,
      ...(result.requestId ? { requestId: result.requestId } : {}),
    };
  }

  revalidatePath("/panel/modules");
  redirect(`/panel/modules/${encodeURIComponent(parsed.data.key)}`);
}
