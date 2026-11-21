import { expect, test } from "@playwright/test";
import { fixtures, type Fixtures } from "./global-setup";

/**
 * The public invitation page, end to end in a real browser: the first door a
 * person sees, and the one no unit test can prove (cookies, server actions,
 * redirects).
 */

// globalSetup has written the fixtures by the time the specs run.
let view: Fixtures;
test.beforeAll(() => {
  view = fixtures();
});

test("an invitation with a new email creates the account and lands on welcome", async ({ page }) => {
  await page.goto(`/invite/${view.tokens.newAccount}`);

  await page.getByLabel("Name").fill(view.invitee.name);
  await page.getByLabel("Email").fill(view.invitee.email);
  await page.getByLabel("Password", { exact: true }).fill(view.invitee.password);
  await page.getByLabel("Confirm password").fill(view.invitee.password);
  await page.getByRole("button", { name: "Accept invitation" }).click();

  await page.waitForURL(/\/welcome/);
  await expect(page.getByRole("heading", { name: "Your account is ready" })).toBeVisible();
});

test("an existing email stops and asks for that account's password", async ({ page }) => {
  await page.goto(`/invite/${view.tokens.existingAccount}`);

  await page.getByLabel("Name").fill("Intento Duplicado");
  await page.getByLabel("Email").fill(view.existing.email);
  await page.getByLabel("Password", { exact: true }).fill(view.invitee.password);
  await page.getByLabel("Confirm password").fill(view.invitee.password);
  await page.getByRole("button", { name: "Accept invitation" }).click();

  // No sign-in, no redirect: the page says the account exists.
  await expect(
    page.getByText("That email already has an account. Enter its current password"),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/invite\//);
  await expect(page.getByLabel("Current password")).toBeVisible();

  // Confirming with the real password applies the invitation to that account.
  await page.getByLabel("Current password").fill(view.existing.password);
  await page.getByRole("button", { name: "Sign in and accept" }).click();

  await page.waitForURL(/\/welcome\?notice=existing_account/);
  await expect(page.getByRole("heading", { name: "You are already a member" })).toBeVisible();
});

test("a link that does not exist says so without a stack trace", async ({ page }) => {
  const response = await page.goto("/invite/027_inv_none");

  expect(response?.status()).toBe(200);
  await expect(page.getByText("This invitation link is not valid.")).toBeVisible();
});
