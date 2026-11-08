import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { validateManifest } from "@027apps/core/modules/manifest.js";
import { modulesRoot } from "@/lib/modules";

/** Why a package cannot be offered: the Core would reject it anyway. */
export type ModulePackageReason = "invalid_manifest" | "key_mismatch";

/** Listing metadata only: no absolute path and no manifest content leaves this module. */
export interface ModulePackage {
  key: string;
  name: string;
  version: string;
  description: string;
  /** `true` when the manifest is valid and its key matches the folder. */
  valid: boolean;
  reason?: ModulePackageReason;
}

interface PackageFields {
  key: string;
  name: string;
  version: string;
  description: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

/**
 * Best-effort fields for a manifest that may fail validation: every missing
 * field falls back to the folder name, never to a path.
 */
function readFields(value: unknown, fallback: string): PackageFields {
  if (!isRecord(value)) {
    return { key: fallback, name: fallback, version: fallback, description: fallback };
  }
  const branding = isRecord(value.branding) ? value.branding : {};
  return {
    key: readString(value.key) ?? fallback,
    name: readString(value.name) ?? fallback,
    version: readString(value.version) ?? fallback,
    description: readString(branding.description) ?? fallback,
  };
}

/** Reads one package folder; any disk or manifest error becomes `valid: false`. */
async function readPackage(directory: string): Promise<ModulePackage> {
  let raw: unknown;
  try {
    const text = await readFile(join(modulesRoot(), directory, "manifest.json"), "utf8");
    raw = JSON.parse(text) as unknown;
  } catch {
    return {
      key: directory,
      name: directory,
      version: directory,
      description: directory,
      valid: false,
      reason: "invalid_manifest",
    };
  }

  const fields = readFields(raw, directory);
  try {
    const manifest = validateManifest(raw);
    if (manifest.key !== directory) {
      return { ...fields, valid: false, reason: "key_mismatch" };
    }
    return {
      key: manifest.key,
      name: manifest.name,
      version: manifest.version,
      description: manifest.branding.description,
      valid: true,
    };
  } catch {
    return { ...fields, valid: false, reason: "invalid_manifest" };
  }
}

/**
 * Trusted packages present under `MODULES_ROOT`, one entry per first-level
 * directory. The manifest is validated with the Core schema so the panel and
 * the installer cannot disagree about what is installable. A missing or
 * unreadable root is an empty list: the page shows no offers, not an error.
 */
export async function listModulePackages(): Promise<ModulePackage[]> {
  let entries;
  try {
    entries = await readdir(modulesRoot(), { withFileTypes: true });
  } catch {
    return [];
  }

  const directories = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));

  return Promise.all(directories.map((directory) => readPackage(directory)));
}
