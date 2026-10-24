import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const palette =
  "slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose";
const utilities =
  "bg|text|border|ring|ring-offset|outline|fill|stroke|from|via|to|divide|decoration|accent|caret|shadow|placeholder";

// Colores hardcodeados: solo se permiten tokens semánticos (bg-background, text-foreground...).
const hardcodedColor = [
  // Paleta de Tailwind: bg-gray-100, dark:text-slate-50, border-red-500/50...
  `\\b(${utilities})-(${palette})-\\d{2,3}\\b`,
  // Blanco/negro crudos: bg-white, text-black...
  `\\b(${utilities})-(white|black)\\b`,
  // Valores arbitrarios: bg-[#fff], text-[rgb(0,0,0)]...
  `\\b(${utilities})-\\[(#|rgba?\\(|hsla?\\(|oklch\\(|oklab\\(|lab\\(|lch\\()`,
  // Literal que es un color completo: "#fff", "rgb(0 0 0)"...
  `^\\s*(#[0-9a-fA-F]{3,8}|(rgba?|hsla?|oklch|oklab|lab|lch)\\([^)]*\\))\\s*$`,
].join("|");

const message =
  "Color hardcodeado: usa un token semántico (p. ej. bg-background, text-foreground) definido en src/app/globals.css. Ver docs/conventions/code-style.md.";

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
