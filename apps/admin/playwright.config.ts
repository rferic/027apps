import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests against a real panel and a real local Supabase.
 *
 * `qa:web` picks up whatever is already answering on 3003 (the dev server you
 * run while developing); inside CI the workflow starts it first. A run creates
 * its own `qa-e2e-*@test.local` accounts and deletes them afterwards.
 */
const baseURL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3003";

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  // One worker: the flows share one instance's quota and settings.
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
    video: "off",
    locale: "en-GB",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "pnpm dev",
    port: 3003,
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
