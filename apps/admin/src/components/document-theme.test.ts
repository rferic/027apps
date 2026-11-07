import { describe, expect, it } from "vitest";
import { applyTheme, themeFromCookie, type ThemeRoot } from "@/lib/theme";

function fakeRoot(): ThemeRoot & { classes: Set<string> } {
  const classes = new Set<string>();
  return {
    classes,
    classList: {
      toggle(name: string, force?: boolean) {
        if (force) classes.add(name);
        else classes.delete(name);
      },
    },
    style: { colorScheme: "" },
  };
}

describe("document theme", () => {
  it("turns the cookie value into a theme", () => {
    expect(themeFromCookie("dark")).toBe("dark");
    expect(themeFromCookie("light")).toBe("light");
    expect(themeFromCookie("nonsense")).toBe("system");
  });

  it("applies the dark class and color-scheme", () => {
    const root = fakeRoot();
    applyTheme(root, "dark");

    expect(root.classes.has("dark")).toBe(true);
    expect(root.classes.has("light")).toBe(false);
    expect(root.style.colorScheme).toBe("dark");
  });

  it("applies the light class even when the OS is dark", () => {
    const root = fakeRoot();
    root.classes.add("dark");
    applyTheme(root, "light");

    expect(root.classes.has("light")).toBe(true);
    expect(root.classes.has("dark")).toBe(false);
    expect(root.style.colorScheme).toBe("light");
  });

  it("clears the override when the theme follows the system", () => {
    const root = fakeRoot();
    root.classes.add("dark");
    applyTheme(root, "system");

    expect(root.classes.size).toBe(0);
    expect(root.style.colorScheme).toBe("");
  });
});
