import { describe, expect, it } from "vitest";
import { DEFAULT_EMOJI, EMOJI_GROUPS } from "./emoji-picker";

/**
 * The palette is content: a duplicate, a group without emojis or a glyph too
 * long for the category column would only show up when somebody taps it.
 */
describe("the category emoji palette", () => {
  it("offers the everyday groups with enough to choose from", () => {
    expect(EMOJI_GROUPS).toHaveLength(6);
    for (const group of EMOJI_GROUPS) {
      expect(group.label.trim()).not.toBe("");
      expect(group.emojis.length).toBeGreaterThanOrEqual(10);
    }
    expect(EMOJI_GROUPS.flatMap((group) => [...group.emojis]).length).toBeGreaterThanOrEqual(60);
  });

  it("never repeats an emoji and starts on one it offers", () => {
    const all = EMOJI_GROUPS.flatMap((group) => [...group.emojis]);
    expect(new Set(all).size).toBe(all.length);
    expect(all).toContain(DEFAULT_EMOJI);
  });

  it("fits the category column, which counts code points", () => {
    for (const emoji of EMOJI_GROUPS.flatMap((group) => [...group.emojis])) {
      expect([...emoji].length).toBeLessThanOrEqual(8);
    }
  });
});
