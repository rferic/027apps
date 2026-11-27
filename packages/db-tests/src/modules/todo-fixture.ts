import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import type { ClientBase } from "pg";
import { createTestUser, query, withClient } from "../pg.js";
import {
  activateModule,
  installModule,
  type ModulesDeps,
} from "@027apps/core/modules/service.js";
import type { Caller } from "@027apps/core/api/types.js";
import type { TodoDb } from "@027apps/todo/domain/types.js";

/** The real Tareas package: manifest, digests, DDL and RLS as shipped. */
export const ROOT = resolve(fileURLToPath(new URL(".", import.meta.url)), "../../../todo");

export const email = (name: string) => `todo-${name}-${Date.now()}-${Math.random()}@test.local`;

export async function inRollback(fn: (c: ClientBase) => Promise<void>): Promise<void> {
  await withClient(async (c) => {
    await c.query("BEGIN");
    try {
      await fn(c);
    } finally {
      await c.query("ROLLBACK");
    }
  });
}

export function deps(c: ClientBase): ModulesDeps {
  const db = { query: (sql: string, params: unknown[] = []) => query(c, sql, params) };
  return {
    db,
    withTransaction: async <T,>(fn: (tx: typeof db) => Promise<T>): Promise<T> => {
      await c.query("savepoint module_op");
      try {
        const result = await fn(db);
        await c.query("release savepoint module_op");
        return result;
      } catch (error) {
        await c.query("rollback to savepoint module_op");
        throw error;
      }
    },
    moduleRoot: () => ROOT,
    readFile: (path) => readFile(path, "utf8"),
  };
}

export async function session(
  c: ClientBase,
  role: "super_admin" | "admin" | "user",
): Promise<Caller & { kind: "session" }> {
  const { id } = await createTestUser(c, { email: email(role), role });
  return { kind: "session", userId: id, role };
}

/** A statement that must fail: the savepoint keeps the transaction usable. */
export async function rejected(c: ClientBase, sql: string, params: unknown[] = []): Promise<string> {
  await c.query("savepoint expect_fail");
  try {
    await query(c, sql, params);
    await c.query("release savepoint expect_fail");
    return "";
  } catch (error) {
    await c.query("rollback to savepoint expect_fail");
    return (error as Error).message;
  }
}

/** Installs the shipped package for a test that is already inside a rollback. */
export async function installTodo(c: ClientBase): Promise<{
  manifest: Record<string, unknown>;
  root: Caller & { kind: "session" };
}> {
  const { uninstallModule } = await import("@027apps/core/modules/service.js");
  const admin = await session(c, "admin");
  const root = await session(c, "super_admin");
  const manifest = JSON.parse(await readFile(resolve(ROOT, "manifest.json"), "utf8"));

  const { rows: installed } = await query(
    c,
    "select state from public.module_registry where key = 'todo'",
  );
  if (installed[0]) {
    await uninstallModule(deps(c), root, "todo", manifest, true);
  }
  await installModule(deps(c), admin, manifest);
  await activateModule(deps(c), admin, "todo");
  return { manifest, root };
}

/** The deps the domain use cases take, over the test client. */
export function todoDeps(c: ClientBase, now?: () => Date) {
  const db: TodoDb = { query: (sql, params = []) => query(c, sql, params) };
  return {
    db,
    ...(now ? { now } : {}),
    withTransaction: async <T,>(fn: (tx: TodoDb) => Promise<T>): Promise<T> => {
      await c.query("savepoint todo_op");
      try {
        const result = await fn(db);
        await c.query("release savepoint todo_op");
        return result;
      } catch (error) {
        await c.query("rollback to savepoint todo_op");
        throw error;
      }
    },
  };
}
