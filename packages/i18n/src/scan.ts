import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Extracts `t("...")` / `t('...')` calls from a source file. The lookbehind
 * avoids matching `it("...")`, `expect.t(...)` or identifiers ending in `t`.
 */
const T_CALL = /(?<![\w.$])t\(\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')\s*[,)]/g;

/** Strings passed to `t(...)` in a source file, in order and without dedupe. */
export function extractStrings(source: string): string[] {
  const strings: string[] = [];
  for (const match of source.matchAll(T_CALL)) {
    const literal = match[1];
    if (literal) strings.push(literal.slice(1, -1));
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

/** Writes the catalog in the canonical format (2 spaces, sorted, final newline). */
export function writeCatalog(catalogPath: string, strings: string[]): void {
  const sorted = [...new Set(strings)].sort((a, b) => a.localeCompare(b));
  fs.writeFileSync(catalogPath, `${JSON.stringify(sorted, null, 2)}\n`, "utf8");
}

function main(): void {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
  const catalogPath = path.join(repoRoot, "packages/i18n/catalog.en.json");
  const strings = scanSources(path.join(repoRoot, "apps/admin/src"));
  writeCatalog(catalogPath, strings);
  process.stdout.write(`i18n scan: ${strings.length} strings written to catalog.en.json\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
