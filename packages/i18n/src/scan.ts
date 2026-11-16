import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Extracts `t("...")` / `t('...')` calls from a source file. The lookbehind
 * avoids matching `it("...")`, `expect.t(...)` or identifiers ending in `t`.
 */
const T_CALL = /(?<![\w.$])t\(\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')\s*[,)]/g;
/** Module panels wrap the translator once, as `tr("...")`. */
const TR_CALL = /(?<![\w.$])tr\(\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')\s*[,)]/g;

/** Strings passed to `t(...)` in a source file, in order and without dedupe. */
export function extractStrings(source: string): string[] {
  const strings: string[] = [];
  for (const pattern of [T_CALL, TR_CALL]) {
    for (const match of source.matchAll(pattern)) {
      const literal = match[1];
      if (literal) strings.push(literal.slice(1, -1));
    }
  }
  return strings;
}

/** Source files under `dir` (`.ts`/`.tsx`, no tests, no build output). */
export function collectSourceFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const files: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".next") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectSourceFiles(full));
      continue;
    }
    if (!/\.(ts|tsx)$/.test(entry.name) || /\.test\.(ts|tsx)$/.test(entry.name)) continue;
    files.push(full);
  }
  return files;
}

/** Sorted, unique catalog strings found in the code under `dir`. */
export function scanSources(dir: string): string[] {
  const found = new Set<string>();
  for (const file of collectSourceFiles(dir)) {
    for (const text of extractStrings(fs.readFileSync(file, "utf8"))) found.add(text);
  }
  return [...found].sort((a, b) => a.localeCompare(b));
}

/** Keeps pre-seeded strings while adding the literals currently used by the app. */
export function mergeCatalog(existing: readonly string[], found: readonly string[]): string[] {
  return [...new Set([...existing, ...found])].sort((a, b) => a.localeCompare(b));
}

/** Writes the catalog in the canonical format (2 spaces, sorted, final newline). */
export function writeCatalog(catalogPath: string, strings: string[]): void {
  const sorted = [...new Set(strings)].sort((a, b) => a.localeCompare(b));
  fs.writeFileSync(catalogPath, `${JSON.stringify(sorted, null, 2)}\n`, "utf8");
}

/** `t()` strings of every module's panel pages (packages/<key>/admin). */
function moduleAdminSources(repoRoot: string): string[] {
  const packagesDir = path.join(repoRoot, "packages");
  if (!fs.existsSync(packagesDir)) return [];
  return fs
    .readdirSync(packagesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((entry) => scanSources(path.join(packagesDir, entry.name, "admin")));
}

function main(): void {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
  const catalogPath = path.join(repoRoot, "packages/i18n/catalog.en.json");
  const existing = fs.existsSync(catalogPath)
    ? (JSON.parse(fs.readFileSync(catalogPath, "utf8")) as string[])
    : [];
  // Module packages render panels of their own: their `t()` strings need the same
  // catalog, or the panel shows English keys inside a Spanish UI.
  const found = [
    ...scanSources(path.join(repoRoot, "apps/admin/src")),
    ...moduleAdminSources(repoRoot),
  ];
  const strings = mergeCatalog(existing, found);
  writeCatalog(catalogPath, strings);
  process.stdout.write(`i18n scan: ${strings.length} strings written to catalog.en.json\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
