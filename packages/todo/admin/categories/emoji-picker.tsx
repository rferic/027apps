/**
 * The emoji palette of the category form. Plain radios: the panel is
 * server-rendered with native forms, so picking one is a form value, not a
 * client bundle. The chips use the semantic tokens, so the palette follows the
 * panel's light and dark themes.
 *
 * The groups mirror `apps/android/.../ui/components/EmojiCatalog.kt`: the app and
 * the panel must offer the same everyday things.
 */

export interface EmojiGroup {
  /** English catalog key; the page translates it. */
  label: string;
  emojis: readonly string[];
}

export const EMOJI_GROUPS: readonly EmojiGroup[] = [
  {
    label: "Home & cleaning",
    emojis: ["🏠", "🛋️", "🛏️", "🧹", "🧽", "🧺", "🧼", "🚿", "🪣", "💡", "🔌", "🪴", "📌"],
  },
  {
    label: "Kitchen & shopping",
    emojis: ["🛒", "🍽️", "🍳", "🥘", "🧴", "🧻", "🥛", "🍞", "🥦", "🍎", "☕", "🗑️"],
  },
  {
    label: "Family & pets",
    emojis: ["👨‍👩‍👧", "🧒", "🎒", "📚", "✏️", "🧸", "🍼", "🐕", "🐈", "🐟", "⚽", "🎨"],
  },
  {
    label: "Papers & money",
    emojis: ["📄", "🧾", "💶", "🏦", "📅", "✉️", "📦", "🖨️", "🗂️", "🔑", "⏰", "🔧"],
  },
  {
    label: "Health & sport",
    emojis: ["💊", "🩺", "🏥", "🦷", "🏃", "🚴", "🏊", "🧘", "🚑", "☀️", "❄️", "🌧️"],
  },
  {
    label: "Travel & fun",
    emojis: ["🚗", "🚌", "🚲", "⛽", "🧳", "✈️", "🎁", "🎉", "🎂", "🎬", "🎮", "🎵"],
  },
] as const;

export const DEFAULT_EMOJI = "📌";

export function EmojiField({ title, labels }: { title: string; labels: Record<string, string> }) {
  return (
    <fieldset className="flex w-full flex-col gap-1.5">
      <legend className="text-xs">{title}</legend>
      <div className="max-h-56 overflow-y-auto rounded-lg border bg-background p-2">
        {EMOJI_GROUPS.map((group) => (
          <div key={group.label} className="mb-2 last:mb-0">
            <p className="px-1 pb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              {labels[group.label] ?? group.label}
            </p>
            <div className="flex flex-wrap gap-1">
              {group.emojis.map((emoji) => (
                <label
                  key={emoji}
                  title={emoji}
                  className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-control border bg-surface text-lg transition-colors hover:bg-muted focus-within:ring-2 focus-within:ring-accent has-[:checked]:border-accent has-[:checked]:bg-accent/10"
                >
                  <input
                    type="radio"
                    name="emoji"
                    value={emoji}
                    defaultChecked={emoji === DEFAULT_EMOJI}
                    aria-label={emoji}
                    className="sr-only"
                  />
                  <span aria-hidden>{emoji}</span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
    </fieldset>
  );
}
