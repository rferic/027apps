import { expect, test } from "@playwright/test";
import { fixtures, type Fixtures } from "./global-setup";

/**
 * The quota request, from the panel side: the member asks when they run out of
 * seats and the administrator approves with an amount, which is what actually
 * gives them seats back.
 */

let view: Fixtures;
test.beforeAll(() => {
  view = fixtures();
});

test("the panel lists the request and approving it grants the seats", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(view.admin.email);
  await page.getByLabel("Password", { exact: true }).fill(view.admin.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/panel/);

  await page.goto("/panel/requests");
  await expect(page.getByText(view.asker.requestReason).first()).toBeVisible();

  await page.getByRole("button", { name: "Approve", exact: true }).click();
  const amount = page.locator(`#approve-amount-table-${view.asker.requestId}`);
  await amount.fill("2");
  // The confirm button names the amount it is about to grant.
  await page.getByRole("button", { name: "Approve 2 seat(s)" }).click();

  await expect(page.getByText("Approved").first()).toBeVisible({ timeout: 20_000 });

  // The member page shows the grant the approval created.
  await page.goto(`/panel/members/${view.asker.id}`);
  await expect(page.getByText("+2 seat(s)")).toBeVisible();
});

test("the panel counter shows a new request without reloading", async ({ page, request }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(view.admin.email);
  await page.getByLabel("Password", { exact: true }).fill(view.admin.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/panel/);

  // The badge lives on the dashboard and polls; the request arrives afterwards.
  await page.goto("/panel");
  const badge = page.getByLabel(/\d+ pending request/);
  const before = (await badge.count()) > 0 ? Number(await badge.innerText()) : 0;
  const created = await request.post(`${view.baseURL}/api/v1/me/invitation-requests`, {
    headers: { Authorization: `Bearer ${view.asker2.token}` },
    data: { amount: 1, reason: "Sin plazas" },
  });
  expect(created.status()).toBe(201);

  // A tab that regains focus polls immediately, which is the path a person
  // takes when coming back from another window.
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(badge).toHaveText(String(before + 1), { timeout: 20_000 });
});
