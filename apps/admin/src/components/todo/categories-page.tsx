import type { ModulePageContext } from "@027apps/core/modules/pages.js";
import TodoCategories from "@027apps/todo/admin/categories/page";
import { deleteCategoryAction, saveCategoryAction } from "@/lib/todo-actions";

/** Injects the server actions: the package page stays free of Next and of the app. */
export default function TodoCategoriesPage({ context }: { context: ModulePageContext }) {
  return (
    <TodoCategories
      context={context}
      actions={{ save: saveCategoryAction, remove: deleteCategoryAction }}
    />
  );
}
