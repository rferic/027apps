#!/usr/bin/env node
/**
 * `pnpm check:parity` — the mobile parity matrix must stay honest.
 *
 * Validates `docs/ai/parity.md` and the scenarios under `spec/mobile/`:
 *   1. every row has a well-formed id, a capability and two valid states;
 *   2. ids are unique, and so are scenario ids;
 *   3. each scenario id starts with a capability that exists in the matrix, so
 *      behaviour cannot drift away from the table;
 *   4. a capability marked `hecho` on Android has `hecho` on iOS **or** a
 *      declared motive. While the iOS phase has not started the matrix carries
 *      a `## Baseline iOS pendiente` section: the rule relaxes to a warning so
 *      the check is useful today, and turns strict the day that section goes.
 *
 * No dependencies: it reads two text formats and is cheap enough for CI.
 */

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const MATRIX = join(ROOT, "docs/ai/parity.md");
const SCENARIOS = join(ROOT, "spec/mobile");
const BASELINE_HEADING = "## Baseline iOS pendiente";

const STATES = new Set(["hecho", "en curso", "pendiente", "n/a"]);
const ID = /^[a-z][a-z0-9-]*\.[a-z0-9][a-z0-9.-]*$/;

const errors = [];
const warnings = [];

function fail(message) {
  errors.push(message);
}

function warn(message) {
  warnings.push(message);
}

const markdown = readFileSync(MATRIX, "utf8");
const relaxed = markdown.includes(BASELINE_HEADING);

/** `| \`id\` | cap | android | ios | note |` → the four meaningful cells. */
function parseRows(text) {
  const rows = [];
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\|\s*`([^`]+)`\s*\|(.*)\|\s*$/);
    if (!match) continue;
    const cells = match[2].split("|").map((cell) => cell.trim());
    rows.push({ id: match[1], capability: cells[0], android: cells[1], ios: cells[2], note: cells[3] ?? "" });
  }
  return rows;
}

const rows = parseRows(markdown);
if (rows.length < 10) fail(`only ${rows.length} rows parsed from the matrix; the table format changed`);

const seen = new Set();
for (const row of rows) {
  if (!ID.test(row.id)) fail(`${row.id}: id must look like "area.capability"`);
  if (seen.has(row.id)) fail(`${row.id}: duplicated row`);
  seen.add(row.id);
  if (!row.capability) fail(`${row.id}: the capability text is empty`);
  if (!STATES.has(row.android)) fail(`${row.id}: "android: ${row.android}" is not a valid state`);
  if (!STATES.has(row.ios)) fail(`${row.id}: "ios: ${row.ios}" is not a valid state`);

  if (row.android === "hecho" && row.ios !== "hecho") {
    // A note counts as a declared motive when it says something beyond a plain
    // dash; the matrix already uses that column for real differences.
    const declared = row.note.replace(/\*\*Divergencia\*\*:?/i, "").replace(/[—–-]/g, "").trim() !== "";
    if (!declared) {
      const message = `${row.id}: android is done and iOS is "${row.ios}" with no declared motive`;
      if (relaxed) warn(`${message} (baseline iOS pending)`);
      else fail(message);
    }
  }
}

// --- scenarios: behaviour lives in spec/mobile -----------------------------
const scenarioIds = new Set();
if (!existsSync(SCENARIOS)) {
  warn("spec/mobile/ does not exist yet: no behaviour scenarios to check");
} else {
  for (const file of readdirSync(SCENARIOS).filter((name) => name.endsWith(".yaml"))) {
    const text = readFileSync(join(SCENARIOS, file), "utf8");
    // One block per scenario, from its `- id:` to the next one.
    const blocks = text.split(/^\s*-\s*id:\s*/m).slice(1);
    const ids = blocks.map((block) => (block.match(/^(\S+)/) ?? [])[1] ?? "");
    if (ids.length === 0) warn(`${file}: no scenario ids found`);
    for (const [index, id] of ids.entries()) {
      const block = blocks[index] ?? "";
      for (const field of ["given:", "when:", "then:"]) {
        if (!block.includes(field)) fail(`${file}: ${id} has no "${field}"`);
      }
      if (!/then:\s*\n\s*-\s*\S/.test(block)) {
        fail(`${file}: ${id} needs at least one line under "then"`);
      }
      if (scenarioIds.has(id)) fail(`${file}: duplicated scenario ${id}`);
      scenarioIds.add(id);
      if (!ID.test(id)) fail(`${file}: ${id} does not look like "area.capability.what"`);
      // The closest capability is the longest matrix id the scenario starts with.
      const owner = [...seen]
        .filter((capability) => id === capability || id.startsWith(`${capability}.`))
        .sort((a, b) => b.length - a.length)[0];
      if (!owner) fail(`${file}: ${id} does not belong to any capability in the matrix`);
    }
  }
  if (scenarioIds.size === 0) warn("spec/mobile/ has no scenarios");
}

for (const message of warnings) console.warn(`warn  ${message}`);
for (const message of errors) console.error(`FAIL  ${message}`);

if (errors.length > 0) {
  console.error(`\n${errors.length} parity problem(s)`);
  process.exit(1);
}
console.log(
  `parity ok: ${rows.length} capabilities, ${scenarioIds.size} scenarios` +
    (relaxed ? " (baseline iOS pending: motives are warnings)" : ""),
);
