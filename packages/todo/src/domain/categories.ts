import { TodoDomainError } from "./errors";
import { charLength } from "./permissions";
import type { TodoDeps } from "./types";

/** The instance catalog: every group and the personal folder share it (spec §3.2). */
export const CATEGORY_COLORS = [
  "teal",
  "indigo",
  "violet",
  "amber",
  "rose",
  "emerald",
  "sky",
  "slate",
] as const;

export type CategoryColor = (typeof CATEGORY_COLORS)[number];

export interface CategoryView {
  id: string;
  name: string;
  emoji: string;
  color: CategoryColor;
  sortOrder: number;
}

export interface CategoryInput {
  id?: string;
  name: string;
  emoji: string;
  color: CategoryColor;
  sortOrder?: number;
}

export async function listCategories(deps: TodoDeps): Promise<CategoryView[]> {
  const { rows } = await deps.db.query(
    `select id, name, emoji, color, sort_order
       from module_todo.todo_categories
      order by sort_order, name`,
  );
  return rows.map((row) => ({
    id: String(row.id),
    name: String(row.name),
    emoji: String(row.emoji),
    color: row.color as CategoryColor,
    sortOrder: Number(row.sort_order),
  }));
}

/** The panel administers the catalog; ids are optional so one action saves both. */
export async function saveCategory(
  deps: TodoDeps,
  input: CategoryInput,
): Promise<CategoryView> {
  const name = input.name.trim();
  if (charLength(name) < 1 || charLength(name) > 40) {
    throw new TodoDomainError("validation_failed", "name must be 1..40 characters");
  }
  if (charLength(input.emoji.trim()) < 1 || charLength(input.emoji.trim()) > 8) {
    throw new TodoDomainError("validation_failed", "emoji must be 1..8 characters");
  }
  if (!CATEGORY_COLORS.includes(input.color)) {
    throw new TodoDomainError("validation_failed", "unknown colour slot");
  }
  // One name per catalog: checked first, because a failed insert aborts the
  // caller's transaction (and the panel runs every action in one).
  const { rows: clash } = await deps.db.query(
    `select id from module_todo.todo_categories
      where name = $1 and ($2::uuid is null or id <> $2)`,
    [name, input.id ?? null],
  );
  if (clash[0]) throw new TodoDomainError("validation_failed", "that name already exists");

  const value = [name, input.emoji.trim(), input.color, input.sortOrder ?? 0];

  const { rows } = input.id
    ? await deps.db.query(
        `update module_todo.todo_categories
            set name = $2, emoji = $3, color = $4, sort_order = $5
          where id = $1
          returning id, name, emoji, color, sort_order`,
        [input.id, ...value],
      )
    : await deps.db.query(
        `insert into module_todo.todo_categories (name, emoji, color, sort_order)
         values ($1, $2, $3, $4)
         returning id, name, emoji, color, sort_order`,
        value,
      );

  if (!rows[0]) throw new TodoDomainError("not_found", "category not found");
  return {
    id: String(rows[0].id),
    name: String(rows[0].name),
    emoji: String(rows[0].emoji),
    color: rows[0].color as CategoryColor,
    sortOrder: Number(rows[0].sort_order),
  };
}

/** Deleting leaves the tasks without a category (`on delete set null`). */
export async function deleteCategory(deps: TodoDeps, id: string): Promise<void> {
  const { rows } = await deps.db.query(
    "delete from module_todo.todo_categories where id = $1 returning id",
    [id],
  );
  if (!rows[0]) throw new TodoDomainError("not_found", "category not found");
}
