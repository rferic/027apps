import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const palette =
  "slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose";
const utilities =
  "bg|text|border|ring|ring-offset|outline|fill|stroke|from|via|to|divide|decoration|accent|caret|shadow|placeholder";

// Hardcoded colors: only semantic tokens are allowed (bg-background, text-foreground...).
const hardcodedColor = [
  // Tailwind palette: bg-gray-100, dark:text-slate-50, border-red-500/50...
  `\\b(${utilities})-(${palette})-\\d{2,3}\\b`,
  // Raw white/black: bg-white, text-black...
  `\\b(${utilities})-(white|black)\\b`,
  // Arbitrary values: bg-[#fff], text-[rgb(0,0,0)]...
  `\\b(${utilities})-\\[(#|rgba?\\(|hsla?\\(|oklch\\(|oklab\\(|lab\\(|lch\\()`,
  // Literal that is a complete color: "#fff", "rgb(0 0 0)"...
  `^\\s*(#[0-9a-fA-F]{3,8}|(rgba?|hsla?|oklch|oklab|lab|lch)\\([^)]*\\))\\s*$`,
].join("|");

const message =
  "Hardcoded color: use a semantic token (e.g. bg-background, text-foreground) defined in src/app/globals.css. See docs/conventions/code-style.md.";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      complexity: ["error", 10],
      "max-depth": ["error", 3],
      "max-params": ["error", 4],
      "no-restricted-syntax": [
        "error",
        { selector: `Literal[value=/${hardcodedColor}/]`, message },
        { selector: `TemplateElement[value.raw=/${hardcodedColor}/]`, message },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
