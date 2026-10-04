import { expect, type Page } from '@playwright/test'

export type AdminCredentials = { email: string; password: string }

// Authenticate through the real API. Login-page rendering is covered separately;
// every workflow test gets fresh cookies rather than relying on a previous test.
export async function loginAdmin(page: Page, creds: AdminCredentials) {
  const response = await page.request.post('/api/admins/login', { data: creds })
  await expect(response).toBeOK()
  await page.goto('/admin/drug-test-upload', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('[data-wizard-ready="true"]')).toBeVisible({ timeout: 30_000 })
}
