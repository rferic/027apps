#!/usr/bin/env node
/**
 * OpenAPI parity gate.
 *
 * 1. Regenerates the document in check mode (the registry is the source; the
 *    committed file must match it).
 * 2. Compares every `apps/admin/src/app/api/v1/**\/route.ts` method with the
 *    paths/methods in the generated document.
 *
 * This is what makes the "declared once" metadata honest: a route handler
 * without an operation, or an operation without a handler, fails CI.
 */
import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const apiRoot = path.join(repoRoot, "apps/admin/src/app/api/v1");
const documentPath = path.join(repoRoot, "docs/api/openapi.json");
const HTTP_METHODS = new Set(["get", "post", "patch", "put", "delete", "head", "options"]);
const METHOD_EXPORT = /export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/g;

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

function walk(dir) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(full));
    else if (entry.isFile() && entry.name === "route.ts") files.push(full);
  }
  return files;
}

function routeKey(file) {
  const relative = path.relative(apiRoot, path.dirname(file));
  const segments = relative
    .split(path.sep)
    .filter(Boolean)
    .map((segment) => segment.replace(/^\[([^\]]+)\]$/, "{$1}"));
  return `/${segments.join("/")}`;
}

function routeOperations() {
  const operations = new Set();
  for (const file of walk(apiRoot)) {
    const source = readFileSync(file, "utf8");
    const route = routeKey(file);
    for (const match of source.matchAll(METHOD_EXPORT)) {
      operations.add(`${match[1]} ${route}`);
    }
  }
  return operations;
}

function documentedOperations() {
  const document = JSON.parse(readFileSync(documentPath, "utf8"));
  const operations = new Set();
  for (const [route, pathItem] of Object.entries(document.paths ?? {})) {
    for (const method of Object.keys(pathItem ?? {})) {
      if (HTTP_METHODS.has(method)) operations.add(`${method.toUpperCase()} ${route}`);
    }
  }
  return operations;
}

function sorted(set) {
  return [...set].sort((a, b) => a.localeCompare(b));
}

const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const check = spawnSync(pnpm, ["--filter", "@027apps/core", "openapi:generate", "--check"], {
  cwd: repoRoot,
  stdio: "inherit",
});
if (check.status !== 0) {
  fail("openapi parity: the generated document is out of date");
}

const routes = routeOperations();
const documented = documentedOperations();
const missing = sorted(new Set([...routes].filter((key) => !documented.has(key))));
const extra = sorted(new Set([...documented].filter((key) => !routes.has(key))));

process.stdout.write(
  `openapi parity: ${routes.size} route operation(s), ${documented.size} documented operation(s)\n`,
);

if (missing.length > 0) {
  process.stderr.write("Missing from the OpenAPI registry (route handler exists, no operation):\n");
  for (const key of missing) process.stderr.write(`  ${key}\n`);
}
if (extra.length > 0) {
  process.stderr.write("Declared in the OpenAPI registry with no route handler:\n");
  for (const key of extra) process.stderr.write(`  ${key}\n`);
}

if (missing.length > 0 || extra.length > 0) process.exit(1);

process.stdout.write("openapi parity: every route and every operation match\n");
