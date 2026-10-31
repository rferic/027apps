#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const errors = [];

function read(relativePath) {
  const absolute = path.join(root, relativePath);
  try {
    return fs.readFileSync(absolute, "utf8");
  } catch {
    errors.push(`Missing file: ${relativePath}`);
    return null;
  }
}

function readJson(relativePath) {
  const content = read(relativePath);
  if (content === null) return null;
  try {
    return JSON.parse(content);
  } catch {
    errors.push(`Invalid JSON: ${relativePath}`);
    return null;
  }
}

const schema = readJson("docs/ai/manifest.schema.json");
const schemaVersion = schema?.["x-manifest-version"];
if (!schemaVersion) {
  errors.push('Missing "x-manifest-version" in docs/ai/manifest.schema.json');
}

const doc = read("docs/ai/module-system.md");
const docVersion = doc?.match(/\*\*Manifest version:\*\*\s*([0-9]+\.[0-9]+\.[0-9]+)/)?.[1];
if (!docVersion) {
  errors.push("Missing '**Manifest version:** x.y.z' in docs/ai/module-system.md");
}

if (schemaVersion && docVersion && schemaVersion !== docVersion) {
  errors.push(`Manifest version mismatch: schema=${schemaVersion} doc=${docVersion}`);
}

const pointers = [
  "AGENTS.md",
  "CLAUDE.md",
  ".opencode/skills/new-module/SKILL.md",
  ".claude/skills/new-module/SKILL.md",
  ".agents/skills/new-module/SKILL.md",
];

for (const pointer of pointers) {
  const content = read(pointer);
  if (content !== null && !content.includes("docs/ai/module-system.md")) {
    errors.push(`Missing canonical doc pointer in ${pointer}`);
  }
}

if (errors.length > 0) {
  for (const error of errors) {
    console.error(`error: ${error}`);
  }
  process.exit(1);
}

console.log(
  `AI docs check passed (manifest ${schemaVersion}; ${pointers.length} pointers checked).`,
);
