import { t } from "@027apps/i18n/t.js";
import type { ModulePageContext } from "@027apps/core/modules/pages.js";
import { CATEGORY_COLORS, listCategories } from "@027apps/todo/domain/categories.js";
import { EmojiField } from "./emoji-picker";

/** The actions the panel wrapper injects; the page only renders the forms. */
export interface CategoryActions {
  save: (formData: FormData) => Promise<void>;
  remove: (formData: FormData) => Promise<void>;
}

const SLOT_STYLE: Record<string, string> = {
  teal: "bg-[var(--module-teal)]",
  indigo: "bg-[var(--module-indigo)]",
  violet: "bg-[var(--module-violet)]",
  amber: "bg-[var(--module-amber)]",
  rose: "bg-[var(--module-rose)]",
  emerald: "bg-[var(--module-emerald)]",
  sky: "bg-[var(--module-sky)]",
  slate: "bg-[var(--module-slate)]",
};

/**
 * The instance catalog every group shares. Native forms: no client bundle, and
 * the action repeats the panel gate because an action is a public endpoint.
 */
export default async function TodoCategories({
  context,
  actions,
}: {
  context: ModulePageContext;
  actions: CategoryActions;
}) {
  const tr = (text: string) => t(text, context.messages);
  // Literal calls on purpose: the i18n scan reads the literal argument, not a variable.
  const emojiLabels: Record<string, string> = {
    "Home & cleaning": tr("Home & cleaning"),
    "Kitchen & shopping": tr("Kitchen & shopping"),
    "Family & pets": tr("Family & pets"),
    "Papers & money": tr("Papers & money"),
    "Health & sport": tr("Health & sport"),
    "Travel & fun": tr("Travel & fun"),
  };
  const categories = await listCategories({ db: context.db });
  const error = typeof context.searchParams.error === "string" ? context.searchParams.error : null;
  const ok = typeof context.searchParams.ok === "string" ? context.searchParams.ok : null;

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold">{tr("Categories")}</h2>
        <p className="text-sm text-muted-foreground">
          {tr("Shared by every group and the personal one. Only the eight colour slots.")}
        </p>
      </header>

      {error && (
        <p role="alert" className="rounded-md border border-destructive/40 p-3 text-sm">
          {error === "validation" ? tr("Check the name, the emoji and the colour.") : tr("That did not work.")}
        </p>
      )}
      {ok && (
        <p role="status" className="rounded-md border p-3 text-sm">
          {tr("Saved.")}
        </p>
      )}

      <form action={actions.save} className="flex flex-wrap items-end gap-2 rounded-lg border p-3">
        <input type="hidden" name="id" value="" />
        <label className="flex flex-col gap-1 text-xs">
          {tr("Name")}
          <input name="name" required maxLength={40} className="rounded-md border px-2 py-1 text-sm" />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          {tr("Colour")}
          <select name="color" defaultValue="slate" className="rounded-md border px-2 py-1 text-sm">
            {CATEGORY_COLORS.map((color) => (
              <option key={color} value={color}>
                {color}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs">
          {tr("Order")}
          <input name="sort_order" type="number" defaultValue={categories.length * 10} className="w-24 rounded-md border px-2 py-1 text-sm" />
        </label>
        <div className="w-full">
          <EmojiField title={tr("Emoji")} labels={emojiLabels} />
        </div>
        <button type="submit" className="rounded-md border px-3 py-1.5 text-sm font-medium">
          {tr("Add")}
        </button>
      </form>

      <ul className="flex flex-col divide-y rounded-lg border">
        {categories.length === 0 && (
          <li className="p-6 text-center text-sm text-muted-foreground">{tr("No categories yet.")}</li>
        )}
        {categories.map((category) => (
          <li key={category.id} className="flex flex-wrap items-center gap-3 p-3">
            <span aria-hidden>{category.emoji}</span>
            <span className="font-medium">{category.name}</span>
            <span className={`h-3 w-3 rounded-sm ${SLOT_STYLE[category.color] ?? ""}`} aria-label={category.color} />
            <span className="text-xs text-muted-foreground">#{category.sortOrder}</span>
            <form action={actions.remove} className="ml-auto">
              <input type="hidden" name="id" value={category.id} />
              <button type="submit" className="rounded-md border px-2 py-1 text-xs">
                {tr("Delete")}
              </button>
            </form>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">
        {tr("Deleting a category leaves its tasks without one.")}
      </p>
    </section>
  );
}
