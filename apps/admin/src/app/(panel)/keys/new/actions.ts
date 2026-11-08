"use server";

import { loadUserModules, type UserModulesResult } from "@/lib/panel-user-modules";

/**
 * Modules granted to the delegated key's owner, loaded when the owner changes.
 * The in-process Core route enforces the caller's scopes, so this action never
 * widens what the panel session can read.
 */
export async function loadUserModulesAction(userId: string): Promise<UserModulesResult> {
  return loadUserModules(userId);
}
