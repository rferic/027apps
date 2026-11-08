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
        id: "inventory",
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
        id: "broken",
        key: "broken",
        name: "Broken",
        version: "broken",
        description: "broken",
        valid: false,
        reason: "invalid_manifest",
      },
    ]);
  });

  it("marks a manifest that is not JSON as invalid", async () => {
    await mkdir(join(root, "unparsable"), { recursive: true });
    await writeFile(join(root, "unparsable", "manifest.json"), "{", "utf8");

    await expect(listModulePackages()).resolves.toEqual([
      {
        id: "unparsable",
        key: "unparsable",
        name: "unparsable",
        version: "unparsable",
        description: "unparsable",
        valid: false,
        reason: "invalid_manifest",
      },
    ]);
  });

  it("marks a package whose manifest key differs from its folder as not installable", async () => {
    await writeManifest("inventory", { ...VALID_MANIFEST, key: "stock" });

    await expect(listModulePackages()).resolves.toEqual([
      {
        id: "inventory",
        key: "stock",
        name: "Inventory",
        version: "1.0.0",
        description: "Stock control for the household",
        valid: false,
        reason: "key_mismatch",
      },
    ]);
  });

  it("omits a directory without a manifest", async () => {
    await mkdir(join(root, "not-a-package"), { recursive: true });

    await expect(listModulePackages()).resolves.toEqual([]);
  });

  it("omits the plain workspace folders that share the default root", async () => {
    await mkdir(join(root, "core"), { recursive: true });
    await mkdir(join(root, "test-utils"), { recursive: true });
    await writeManifest("inventory", VALID_MANIFEST);

    await expect(listModulePackages()).resolves.toEqual([
      {
        id: "inventory",
        key: "inventory",
        name: "Inventory",
        version: "1.0.0",
        description: "Stock control for the household",
        valid: true,
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

    expect(packages.map((entry) => entry.id)).toEqual(["alpha", "zebra"]);
  });
});
