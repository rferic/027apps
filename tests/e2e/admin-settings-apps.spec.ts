import { test, expect, type Page } from '@playwright/test'

const adminEmail = process.env.TEST_ADMIN_EMAIL ?? ''
const adminPassword = process.env.TEST_ADMIN_PASSWORD ?? ''

async function loginAsAdmin(page: Page) {
  await page.goto('/en/auth/login')
  await page.getByLabel(/email/i).fill(adminEmail)
  await page.getByLabel(/password/i).fill(adminPassword)
  await page.getByRole('button', { name: /sign in|login|iniciar/i }).click()
  await page.waitForURL(/\/en\/admin\/dashboard/)
}

test('admin settings apps: page loads and shows app list', async ({ page }) => {
  await loginAsAdmin(page)

  // Navigate to /admin/settings/apps
  await page.goto('/en/admin/settings/apps')
  await expect(page).toHaveURL(/\/en\/admin\/settings\/apps/)

  // Page title should be visible
  await expect(page.getByRole('heading', { name: /applications/i })).toBeVisible()

  // Subtitle should be visible
  await expect(page.getByText(/drag and drop/i)).toBeVisible()
})

test('admin settings apps: sidebar shows App Order in settings', async ({ page }) => {
  await loginAsAdmin(page)

  // Navigate to admin dashboard first
  await page.goto('/en/admin/dashboard')

  // Click Settings in sidebar to expand
  const settingsButton = page.getByRole('button', { name: /settings/i })
  await settingsButton.click()

  // App Order should appear in the submenu
  await expect(page.getByRole('link', { name: /applications/i })).toBeVisible()
})
