"use server";

import { requirePanel } from "@/lib/panel-guard";
import { loadUserModules, type UserModulesResult } from "@/lib/panel-user-modules";

/**
 * Modules granted to the delegated key's owner, loaded when the owner changes.
 * The in-process Core route enforces the caller's scopes, so this action never
 * widens what the panel session can read. The panel gate is repeated here
 * because a server action is callable outside the page render.
 */
export async function loadUserModulesAction(userId: string): Promise<UserModulesResult> {
  const gate = await requirePanel("super_admin");
  if ("denied" in gate) return { ok: false, code: "insufficient_scope" };
  return loadUserModules(userId);
}
