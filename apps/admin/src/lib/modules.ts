import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";

/**
 * Trusted module packages live under `packages/<key>/`. The manifest and SQL
 * are read server-side; the HTTP client never supplies DDL.
 *
 * `MODULES_ROOT` wins. Otherwise the first existing candidate is used: the
 * monorepo checkout next to the app (dev) or the `packages/` folder Next copies
 * into the serverless bundle beside the function root. The last candidate is
 * returned even when missing so a broken deploy fails as "no packages" instead
 * of throwing a different error than dev.
 */
export function modulesRoot(cwd: string = process.cwd()): string {
  const explicit = process.env.MODULES_ROOT;
  if (explicit) return explicit;
  const monorepo = resolve(cwd, "../../packages");
  if (existsSync(monorepo)) return monorepo;
  const bundled = resolve(cwd, "packages");
  if (existsSync(bundled)) return bundled;
  return monorepo;
}

export async function loadModuleManifest(key: string): Promise<unknown | null> {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(key)) return null;
  try {
    const text = await readFile(join(modulesRoot(), key, "manifest.json"), "utf8");
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

export function moduleRoot(key: string): string {
  return join(modulesRoot(), key);
}

export async function readModuleFile(path: string): Promise<string> {
  return readFile(path, "utf8");
}
