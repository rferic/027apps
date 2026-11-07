import { readFileSync, readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC_ROOT = fileURLToPath(new URL("../..", import.meta.url));

/**
 * Only the shared component may render a native `<dialog>`; the mobile drawer
 * is the documented exception because it needs a side layout. Tests are
 * skipped: they assert the element inside strings on purpose.
 */
const ALLOWED = new Set(["components/ui/dialog.tsx", "components/panel-mobile-menu.tsx"]);

function tsxFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return tsxFiles(path);
    return entry.isFile() && entry.name.endsWith(".tsx") && !entry.name.endsWith(".test.tsx")
      ? [path]
      : [];
  });
}

/** Comments mention `<dialog>` to explain the pattern; only real tags count. */
function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

describe("native <dialog> usage", () => {
  it("keeps raw <dialog> elements inside the shared component", () => {
    const offenders = tsxFiles(SRC_ROOT)
      .filter((file) => /<dialog(?=[\s>])/.test(withoutComments(readFileSync(file, "utf8"))))
      .map((file) => relative(SRC_ROOT, file).split(sep).join("/"))
      .filter((file) => !ALLOWED.has(file));

    expect(
      offenders,
      `Raw <dialog> outside components/ui/dialog.tsx: ${offenders.join(", ")}. ` +
        "Use the shared Dialog from @/components/ui/dialog (it supplies bg-surface " +
        "text-foreground and the backdrop token).",
    ).toEqual([]);
  });

  it("keeps the shared Dialog's surface and foreground tokens", () => {
    const source = readFileSync(join(SRC_ROOT, "components/ui/dialog.tsx"), "utf8");

    expect(source).toContain("text-foreground");
    expect(source).toContain("bg-surface");
  });
});
