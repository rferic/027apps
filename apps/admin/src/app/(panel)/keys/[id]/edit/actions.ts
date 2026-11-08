"use server";

import { redirect } from "next/navigation";
import {
  buildApiKeyUpdateInput,
  mergeKeyScopes,
  splitKeyScopes,
  type ApiKeyEditState,
} from "@/lib/api-key-edit";
import { apiKeyOfferedScopes } from "@/lib/api-key-module-scopes";
import { loadKey, updateKey, type ApiKeyUpdate } from "@/lib/panel-keys";
import {
  loadModulesForOwner,
  modulesFailure,
  offeredModuleList,
} from "@/lib/panel-user-modules";

/**
 * The patch the form submits: the stored scopes the form cannot offer travel
 * untouched, and the selection is limited to the offered set.
 */
function patchFromFormData(
  preserved: readonly string[],
  offered: readonly string[],
  formData: FormData,
): ApiKeyUpdate | null {
  const selected = formData.getAll("scopes").map((value) => String(value));
  return buildApiKeyUpdateInput({
    name: String(formData.get("name") ?? ""),
    scopes: mergeKeyScopes(preserved, selected, offered),
    expiresAt: String(formData.get("expires_at") ?? ""),
    currentExpiresAt: String(formData.get("current_expires_at") ?? ""),
  });
}

/**
 * Saves the editable fields through the Core route in process. The API owns
 * the rules (immutable kind/cap/owner, `409 revoked`, `400` validation), so a
 * failure comes back as state and only success leaves the page.
 *
 * The form offers the Core allowlist plus the modules granted to the owner. Any
 * other stored scope (a module no longer granted, a legacy scope) is reloaded
 * and re-injected into the patch: saving this form can never drop it.
 */
export async function updateKeyAction(
  id: string,
  _previous: ApiKeyEditState,
  formData: FormData,
): Promise<ApiKeyEditState> {
  const stored = await loadKey(id);
  if (!stored.ok) return { error: stored };

  const modules = await loadModulesForOwner(stored.apiKey);
  const modulesError = modulesFailure(modules);
  if (modulesError) return { error: modulesError };

  const offered = apiKeyOfferedScopes(
    stored.apiKey.kind,
    stored.apiKey.roleCap ?? "",
    offeredModuleList(modules),
  );
  const { preserved } = splitKeyScopes(stored.apiKey.scopes, offered);
  const patch = patchFromFormData(preserved, offered, formData);
  if (!patch) return { error: { ok: false, code: "validation_failed" } };

  const result = await updateKey(id, patch);
  if (!result.ok) return { error: result };

  redirect(`/keys/${encodeURIComponent(id)}`);
}
