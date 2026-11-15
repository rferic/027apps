import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { cache } from "react";
import { validateManifest, type ModuleManifest } from "@027apps/core/modules/manifest.js";
import { modulesRoot } from "@/lib/modules";

const KEY = /^[a-z0-9][a-z0-9-]*$/;

/**
 * The package manifest for one module, validated with the Core schema, or
 * `null` when the package is missing or invalid. Cached per request: the
 * module page and the host read it more than once.
 */
export const loadModuleManifest = cache(
  async (key: string): Promise<ModuleManifest | null> => {
    if (!KEY.test(key)) return null;
    let raw: unknown;
    try {
      raw = JSON.parse(await readFile(join(modulesRoot(), key, "manifest.json"), "utf8"));
    } catch {
      return null;
    }
    try {
      return validateManifest(raw);
    } catch {
      return null;
    }
  },
);
