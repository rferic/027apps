import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";

/**
 * Trusted module packages live under `packages/<key>/`. The manifest and SQL
 * are read server-side; the HTTP client never supplies DDL.
 *
 * On a serverless deploy the packages must be bundled with the app; the
 * packaging step lands with the first real module (task-11).
 */
function modulesRoot(): string {
  return process.env.MODULES_ROOT ?? resolve(process.cwd(), "../../packages");
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
