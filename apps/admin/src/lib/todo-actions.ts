"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getInfra } from "@/lib/api/door";
import { requirePanel } from "@/lib/panel-guard";
import {
  CATEGORY_COLORS,
  deleteCategory,
  saveCategory,
  type CategoryColor,
} from "@027apps/todo/domain/categories.js";

/**
 * The panel writes only the catalog (spec §9). Tasks, points and seasons are not
 * touched from here: the module's API owns those rules.
 *
 * Every action repeats the panel gate — an action is a public endpoint — and
 * turns a refusal into a code in the URL, never into a stack trace.
 */
const PAGE = "/panel/todo/categories";

async function deps() {
  const { settingsDeps } = await getInfra();
  return { db: settingsDeps.db };
}

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export async function saveCategoryAction(formData: FormData): Promise<void> {
  const panel = await requirePanel("admin");
  if ("denied" in panel) redirect(`${PAGE}?error=forbidden`);

  const color = text(formData, "color") as CategoryColor;
  const id = text(formData, "id");
  const sortOrder = Number(text(formData, "sort_order"));
  if (!CATEGORY_COLORS.includes(color)) redirect(`${PAGE}?error=validation`);

  try {
    await saveCategory(await deps(), {
      ...(id ? { id } : {}),
      name: text(formData, "name"),
      emoji: text(formData, "emoji"),
      color,
      sortOrder: Number.isFinite(sortOrder) ? sortOrder : 0,
    });
  } catch {
    redirect(`${PAGE}?error=conflict`);
  }
  revalidatePath(PAGE);
  redirect(`${PAGE}?ok=saved`);
}

export async function deleteCategoryAction(formData: FormData): Promise<void> {
  const panel = await requirePanel("admin");
  if ("denied" in panel) redirect(`${PAGE}?error=forbidden`);
  try {
    await deleteCategory(await deps(), text(formData, "id"));
  } catch {
    redirect(`${PAGE}?error=not_found`);
  }
  revalidatePath(PAGE);
  redirect(`${PAGE}?ok=deleted`);
}
