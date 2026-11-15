import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadModuleManifest, modulesRoot } from "./modules";

let root: string;
const originalRoot = process.env.MODULES_ROOT;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "modules-root-"));
  delete process.env.MODULES_ROOT;
});

afterEach(async () => {
  if (originalRoot === undefined) delete process.env.MODULES_ROOT;
  else process.env.MODULES_ROOT = originalRoot;
  await rm(root, { recursive: true, force: true });
});

describe("modulesRoot", () => {
  it("prefers MODULES_ROOT over any checkout", async () => {
    process.env.MODULES_ROOT = join(root, "explicit");
    await mkdir(join(root, "app", "apps", "admin"), { recursive: true });
    await mkdir(join(root, "app", "packages"), { recursive: true });
    expect(modulesRoot(join(root, "app", "apps", "admin"))).toBe(join(root, "explicit"));
  });

  it("reads the monorepo checkout next to the app in development", async () => {
    const cwd = join(root, "repo", "apps", "admin");
    await mkdir(cwd, { recursive: true });
    await mkdir(join(root, "repo", "packages"), { recursive: true });
    expect(modulesRoot(cwd)).toBe(join(root, "repo", "packages"));
  });

  it("falls back to the packages copied beside the function root", async () => {
    // Serverless: the trace puts `packages/` at the function root, which is cwd.
    const cwd = join(root, "task");
    await mkdir(join(cwd, "packages"), { recursive: true });
    expect(modulesRoot(cwd)).toBe(join(cwd, "packages"));
  });

  it("returns the monorepo candidate when neither exists", async () => {
    const cwd = join(root, "empty", "apps", "admin");
    await mkdir(cwd, { recursive: true });
    expect(modulesRoot(cwd)).toBe(join(root, "empty", "packages"));
  });

  it("returns null for a key that is not a package folder", async () => {
    process.env.MODULES_ROOT = root;
    expect(await loadModuleManifest("../etc")).toBeNull();
    expect(await loadModuleManifest("missing")).toBeNull();
  });
});
