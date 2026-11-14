import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { cache } from "react";
import { modulesRoot } from "@/lib/modules";

const LOCALE = /^[a-z]{2}$/;

/**
 * The module's panel strings for one locale: `locales/<locale>.json`, with
 * `locales/en.json` as the fallback for a missing or partial translation. A
 * missing file is not an error — `t()` falls back to the English key — so a
 * module without locales still renders.
 *
 * These come from the package, not from `public.translations`: the page code
 * and its strings ship together, so a deployment never shows a page whose
 * translations lag behind it.
 */
export const loadModuleMessages = cache(
  async (key: string, locale: string): Promise<Record<string, string>> => {
    const wanted = LOCALE.test(locale) ? locale : "en";
    const base = await readLocale(key, "en");
    if (wanted === "en") return base;
    return { ...base, ...(await readLocale(key, wanted)) };
  },
);

async function readLocale(key: string, locale: string): Promise<Record<string, string>> {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(key)) return {};
  let raw: unknown;
  try {
    raw = JSON.parse(await readFile(join(modulesRoot(), key, "locales", `${locale}.json`), "utf8"));
  } catch {
    return {};
  }
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return {};
  const messages: Record<string, string> = {};
  for (const [textEn, translated] of Object.entries(raw as Record<string, unknown>)) {
    if (textEn.trim() === "" || typeof translated !== "string") continue;
    messages[textEn] = translated;
  }
  return messages;
}
