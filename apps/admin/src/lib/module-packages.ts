import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { validateManifest } from "@027apps/core/modules/manifest.js";
import { modulesRoot } from "@/lib/modules";

/** Why a package cannot be offered: the Core would reject it anyway. */
export type ModulePackageReason = "invalid_manifest" | "key_mismatch";

/** Listing metadata only: no absolute path and no manifest content leaves this module. */
export interface ModulePackage {
  /**
   * First-level folder name. It is the package's identity in the panel: the
   * React key and the join against the installed list. The manifest's `key` is
   * only a claim until it matches this folder.
   */
  id: string;
  /** Manifest key, or the best-effort field when the manifest cannot be trusted. */
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

/** A package folder we cannot trust: every field falls back to the folder name. */
function invalidPackage(directory: string): ModulePackage {
  return {
    id: directory,
    key: directory,
    name: directory,
    version: directory,
    description: directory,
    valid: false,
    reason: "invalid_manifest",
  };
}

/** `ENOENT` means the folder is not a package; every other error is a broken one. */
function isMissingFile(error: unknown): boolean {
  return error instanceof Error && (error as NodeJS.ErrnoException).code === "ENOENT";
}

/**
 * Reads one package folder. A folder without `manifest.json` is not a package
 * and returns `null`: the default root holds workspace folders such as `core`
 * or `test-utils` next to the real packages.
 */
/** A package marked `027apps.devOnly` never reaches a production catalog. */
async function isDevOnly(directory: string): Promise<boolean> {
  try {
    const raw = JSON.parse(
      await readFile(join(modulesRoot(), directory, "package.json"), "utf8"),
    ) as { "027apps"?: { devOnly?: unknown } };
    return raw?.["027apps"]?.devOnly === true;
  } catch {
    return false;
  }
}

async function readPackage(directory: string): Promise<ModulePackage | null> {
  if (process.env.NODE_ENV === "production" && (await isDevOnly(directory))) return null;
  let text: string;
  try {
    text = await readFile(join(modulesRoot(), directory, "manifest.json"), "utf8");
  } catch (error) {
    return isMissingFile(error) ? null : invalidPackage(directory);
  }

  let raw: unknown;
  try {
    raw = JSON.parse(text) as unknown;
  } catch {
    return invalidPackage(directory);
  }

  const fields = readFields(raw, directory);
  try {
    const manifest = validateManifest(raw);
    if (manifest.key !== directory) {
      return { id: directory, ...fields, valid: false, reason: "key_mismatch" };
    }
    return {
      id: directory,
      key: manifest.key,
      name: manifest.name,
      version: manifest.version,
      description: manifest.branding.description,
      valid: true,
    };
  } catch {
    return { id: directory, ...fields, valid: false, reason: "invalid_manifest" };
  }
}

/**
 * Trusted packages present under `MODULES_ROOT`: the first-level directories
 * that ship a `manifest.json`. The manifest is validated with the Core schema
 * so the panel and the installer cannot disagree about what is installable. A
 * missing or unreadable root is an empty list: the page shows no offers, not an
 * error.
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

  const packages = await Promise.all(directories.map((directory) => readPackage(directory)));

  return packages.filter((pkg): pkg is ModulePackage => pkg !== null);
}
