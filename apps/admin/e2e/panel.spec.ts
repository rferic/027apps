import { expect, test } from "@playwright/test";
import { fixtures, type Fixtures } from "./global-setup";

/**
 * The panel with a real session: signing in, listing members and saving a
 * level. It is the surface the owner manages the club from, and the one a
 * rendered-HTML check cannot prove.
 */

// globalSetup has written the fixtures by the time the specs run.
let view: Fixtures;
test.beforeAll(() => {
  view = fixtures();
});

async function signIn(page: import("@playwright/test").Page): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill(view.admin.email);
  await page.getByLabel("Password", { exact: true }).fill(view.admin.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/panel/);
}

test("signing in opens the panel and the members table lists the member", async ({ page }) => {
  await signIn(page);

  await page.goto("/panel/members");
  await expect(page.getByRole("heading", { name: /Members/i })).toBeVisible();
  await expect(page.getByRole("link", { name: view.existing.name })).toBeVisible();
});

test("a member's level can be saved from the member page", async ({ page }) => {
  await signIn(page);

  await page.goto(`/panel/members/${view.existing.id}`);
  const level = page.getByLabel("Level", { exact: true });
  await expect(level).toBeVisible();
  await level.fill("3");
  // Wait for the write itself: reloading while the PATCH is in flight cancels
  // it, which is exactly what a cold route compilation makes likely.
  const patched = page.waitForResponse(
    (response) =>
      response.request().method() === "PATCH" &&
      response.url().includes(`/api/v1/users/${view.existing.id}`),
  );
  await page.getByRole("button", { name: "Save", exact: true }).click();
  expect((await patched).status()).toBe(200);

  // The page revalidates: the field keeps the saved value after the refresh.
  await expect(level).toHaveValue("3", { timeout: 15_000 });
  await page.reload();
  await expect(page.getByLabel("Level", { exact: true })).toHaveValue("3");
});
