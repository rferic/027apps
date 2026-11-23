import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    // Playwright specs live in e2e/ and run with `pnpm qa:web`, not here.
    exclude: ["**/node_modules/**", "**/e2e/**"],
  },
});
