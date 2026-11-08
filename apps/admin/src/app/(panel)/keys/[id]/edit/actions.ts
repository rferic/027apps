"use server";

import { redirect } from "next/navigation";
import {
  buildApiKeyUpdateInput,
  mergeKeyScopes,
  splitKeyScopes,
  type ApiKeyEditState,
} from "@/lib/api-key-edit";
import { allowedApiKeyScopes } from "@/lib/api-key-scopes";
import { loadKey, updateKey } from "@/lib/panel-keys";

/**
 * Saves the editable fields through the Core route in process. The API owns
 * the rules (immutable kind/cap/owner, `409 revoked`, `400` validation), so a
 * failure comes back as state and only success leaves the page.
 *
 * The form only renders the Core allowlist. Any other stored scope is a module
 * permission granted outside the panel, so it is reloaded and re-injected into
 * the patch: saving this form can never drop it.
 */
export async function updateKeyAction(
  id: string,
  _previous: ApiKeyEditState,
  formData: FormData,
): Promise<ApiKeyEditState> {
  const stored = await loadKey(id);
  if (!stored.ok) return { error: stored };

  const allowed = allowedApiKeyScopes(stored.apiKey.kind, stored.apiKey.roleCap ?? "");
  const { preserved } = splitKeyScopes(stored.apiKey.scopes, allowed);
  const selected = formData.getAll("scopes").map((value) => String(value));

  const patch = buildApiKeyUpdateInput({
    name: String(formData.get("name") ?? ""),
    scopes: mergeKeyScopes(preserved, selected, allowed),
    expiresAt: String(formData.get("expires_at") ?? ""),
    currentExpiresAt: String(formData.get("current_expires_at") ?? ""),
  });
  if (!patch) return { error: { ok: false, code: "validation_failed" } };

  const result = await updateKey(id, patch);
  if (!result.ok) return { error: result };

  redirect(`/keys/${encodeURIComponent(id)}`);
}
