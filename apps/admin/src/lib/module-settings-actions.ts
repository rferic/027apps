"use server";

import { revalidatePath } from "next/cache";
import { requirePanel } from "@/lib/panel-guard";
import { saveModuleSetting } from "@/lib/panel-modules";

export type SaveState = { status: "idle" | "ok" | "error" };

function parseValue(type: string, raw: FormDataEntryValue | null): unknown {
  if (type === "bool") return raw === "on";
  if (type === "int") return Number(raw);
  if (type === "json") return JSON.parse(String(raw ?? "null"));
  return String(raw ?? "");
}

/**
 * One setting per action. The Core validates type and range; this only turns
 * the form value into the right JSON type and refreshes the page on success.
 */
export async function saveSettingAction(
  _prev: SaveState,
  formData: FormData,
): Promise<SaveState> {
  await requirePanel("admin");
  const moduleKey = String(formData.get("moduleKey") ?? "");
  const settingKey = String(formData.get("settingKey") ?? "");
  const type = String(formData.get("settingType") ?? "string");
  if (!moduleKey || !settingKey) return { status: "error" };

  let value: unknown;
  try {
    value = parseValue(type, formData.get("value"));
  } catch {
    return { status: "error" };
  }

  const result = await saveModuleSetting(moduleKey, settingKey, value);
  if (!result.ok) return { status: "error" };
  revalidatePath(`/modules/${encodeURIComponent(moduleKey)}/settings`);
  return { status: "ok" };
}
