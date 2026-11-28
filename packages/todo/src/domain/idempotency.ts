import type { Caller } from "./groups";
import { TodoDomainError } from "./errors";
import type { TodoDeps } from "./types";

/**
 * `Idempotency-Key` on the three writes that create something (spec §6): a
 * retried create, complete or request must answer like the first attempt and
 * change nothing.
 *
 * The key is scoped to the user and the endpoint, and the whole use case runs
 * inside one transaction behind a per-key advisory lock: two simultaneous taps
 * queue, and the second one reads the stored answer instead of writing twice.
 */
export async function withIdempotency<T>(
  deps: TodoDeps,
  caller: Caller,
  args: { key: string; endpoint: string },
  run: (deps: TodoDeps) => Promise<T>,
): Promise<T> {
  const key = args.key.trim();
  // The table's own bounds (8..120): fail with the domain code before the SQL does.
  if (key.length === 0) {
    throw new TodoDomainError("validation_failed", "Idempotency-Key is required");
  }
  if (key.length < 8 || key.length > 120) {
    throw new TodoDomainError("validation_failed", "Idempotency-Key must have 8 to 120 characters");
  }

  const exec =
    deps.withTransaction ??
    ((fn: (db: TodoDeps["db"]) => Promise<T>) => fn(deps.db));

  return exec(async (db) => {
    const scoped: TodoDeps = { ...deps, db };
    // Serialize per key: a retry waits for the original and then reads its answer.
    await db.query("select pg_advisory_xact_lock(hashtext($1)::bigint)", [key]);
    const { rows } = await db.query(
      `select endpoint, response from module_todo.todo_idempotency
        where key = $1 and user_id = $2`,
      [key, caller.userId],
    );
    if (rows[0]) {
      if (String(rows[0].endpoint) !== args.endpoint) {
        throw new TodoDomainError("validation_failed", "this key was used for another request");
      }
      return rows[0].response as T;
    }

    const result = await run(scoped);
    await db.query(
      `insert into module_todo.todo_idempotency (key, user_id, endpoint, response)
       values ($1, $2, $3, $4::jsonb)`,
      [key, caller.userId, args.endpoint, JSON.stringify(result)],
    );
    return result;
  });
}
