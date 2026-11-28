import type { TodoDeps } from "./types.js";

/** The instance catalog: every group and the personal folder share it (spec §3.2). */
export interface CategoryView {
  id: string;
  name: string;
  emoji: string;
  color: "teal" | "indigo" | "violet" | "amber" | "rose" | "emerald" | "sky" | "slate";
  sortOrder: number;
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
    color: row.color as CategoryView["color"],
    sortOrder: Number(row.sort_order),
  }));
}
