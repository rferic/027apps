import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { listModulePackages } from "./module-packages";

/** A manifest that passes the Core schema; the tests override single fields. */
const VALID_MANIFEST = {
  key: "inventory",
  name: "Inventory",
  branding: {
    description: "Stock control for the household",
    icon: "assets/icon.svg",
    color: "teal",
  },
  version: "1.0.0",
  is_public: false,
  i18n: ["en"],
  docs: { readme: "README.md" },
};

let root: string;
const originalRoot = process.env.MODULES_ROOT;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "module-packages-"));
  process.env.MODULES_ROOT = root;
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
  if (originalRoot === undefined) delete process.env.MODULES_ROOT;
  else process.env.MODULES_ROOT = originalRoot;
});

async function writeManifest(directory: string, manifest: unknown): Promise<void> {
  await mkdir(join(root, directory), { recursive: true });
  await writeFile(join(root, directory, "manifest.json"), JSON.stringify(manifest), "utf8");
}

describe("listModulePackages", () => {
  it("returns an empty list when the root does not exist", async () => {
    process.env.MODULES_ROOT = join(root, "missing");

    await expect(listModulePackages()).resolves.toEqual([]);
  });

  it("returns an empty list when the root has no package directories", async () => {
    await expect(listModulePackages()).resolves.toEqual([]);
  });

  it("reads a valid package from its manifest", async () => {
    await writeManifest("inventory", VALID_MANIFEST);

    await expect(listModulePackages()).resolves.toEqual([
      {
        key: "inventory",
        name: "Inventory",
        version: "1.0.0",
        description: "Stock control for the household",
        valid: true,
      },
    ]);
  });

  it("marks a manifest that fails the Core schema as invalid", async () => {
    await writeManifest("broken", { key: "broken", name: "Broken" });

    await expect(listModulePackages()).resolves.toEqual([
      {
        key: "broken",
        name: "Broken",
        version: "broken",
        description: "broken",
        valid: false,
        reason: "invalid_manifest",
      },
    ]);
  });

  it("marks a package whose manifest key differs from its folder as not installable", async () => {
    await writeManifest("inventory", { ...VALID_MANIFEST, key: "stock" });

    await expect(listModulePackages()).resolves.toEqual([
      {
        key: "stock",
        name: "Inventory",
        version: "1.0.0",
        description: "Stock control for the household",
        valid: false,
        reason: "key_mismatch",
      },
    ]);
  });

  it("reports a directory without a manifest instead of throwing", async () => {
    await mkdir(join(root, "not-a-package"), { recursive: true });

    await expect(listModulePackages()).resolves.toEqual([
      {
        key: "not-a-package",
        name: "not-a-package",
        version: "not-a-package",
        description: "not-a-package",
        valid: false,
        reason: "invalid_manifest",
      },
    ]);
  });

  it("ignores plain files next to the package directories", async () => {
    await writeFile(join(root, "README.md"), "not a package", "utf8");
    await writeManifest("inventory", VALID_MANIFEST);

    const packages = await listModulePackages();

    expect(packages).toHaveLength(1);
    expect(packages[0]?.key).toBe("inventory");
  });

  it("never exposes absolute server paths", async () => {
    await writeManifest("inventory", VALID_MANIFEST);

    const packages = await listModulePackages();

    expect(JSON.stringify(packages)).not.toContain(root);
  });

  it("sorts packages by folder name", async () => {
    await writeManifest("zebra", { ...VALID_MANIFEST, key: "zebra", name: "Zebra" });
    await writeManifest("alpha", { ...VALID_MANIFEST, key: "alpha", name: "Alpha" });

    const packages = await listModulePackages();

    expect(packages.map((entry) => entry.key)).toEqual(["alpha", "zebra"]);
  });
});
