import fs from 'node:fs'
import path from 'node:path'
import { expect, type Browser, type BrowserContext, type Page } from '@playwright/test'

export type AdminCredentials = {
  email: string
  password: string
}

const adminCookieCache = new Map<string, Awaited<ReturnType<BrowserContext['cookies']>>>()

function getBaseURL() {
  return process.env.PLAYWRIGHT_BASE_URL || process.env.NEXT_PUBLIC_SERVER_URL || 'http://127.0.0.1:3000'
}

function getBaseOrigin() {
  return new URL(getBaseURL()).origin
}

function getCookieCacheKey(creds: AdminCredentials) {
  return `${getBaseOrigin()}::${creds.email.toLowerCase()}`
}

async function fillLoginForm(page: Page, creds: AdminCredentials) {
  const emailInput = page.locator('input[name="email"], input[type="email"]').first()
  const passwordInput = page.locator('input[name="password"], input[type="password"]').first()

  await expect(emailInput).toBeVisible()
  await expect(passwordInput).toBeVisible()

  await emailInput.fill(creds.email)
  await passwordInput.fill(creds.password)

  const submitButton = page
    .getByRole('button', { name: /^(log in|login|sign in)$/i })
    .or(page.locator('button[type="submit"]'))
    .first()

  await submitButton.click()
}

async function isLoginFormVisible(page: Page): Promise<boolean> {
  const emailInput = page.locator('input[name="email"], input[type="email"]').first()
  const passwordInput = page.locator('input[name="password"], input[type="password"]').first()

  const emailVisible = await emailInput.isVisible().catch(() => false)
  const passwordVisible = await passwordInput.isVisible().catch(() => false)
  return emailVisible && passwordVisible
}

async function waitForLoginForm(page: Page, timeoutMs: number): Promise<boolean> {
  const end = Date.now() + timeoutMs
  while (Date.now() < end) {
    if (await isLoginFormVisible(page)) {
      return true
    }
    await page.waitForTimeout(250)
  }
  return false
}

async function waitForAdminShell(page: Page) {
  const indicators = [
    page.getByText('Drug Test Workflow'),
    page.getByText('Select the type of workflow you want to perform'),
    page.getByText('Register New Client'),
    page.getByRole('link', { name: /Drug Test Collector/i }),
    page.getByRole('link', { name: /Drug Test Tracker/i }),
    page.getByRole('heading', { name: /Total Clients/i }),
  ]

  const end = Date.now() + 30_000
  while (Date.now() < end) {
    for (const locator of indicators) {
      if (await locator.first().isVisible().catch(() => false)) {
        return
      }
    }
    await page.waitForTimeout(250)
  }

  throw new Error('Timed out waiting for admin wizard shell to be visible.')
}

async function loginAdminViaAPI(page: Page, creds: AdminCredentials): Promise<boolean> {
  const response = await page.request.post('/api/admins/login', {
    data: {
      email: creds.email,
      password: creds.password,
    },
    failOnStatusCode: false,
  })

  return response.ok()
}

export async function loginAdmin(page: Page, creds: AdminCredentials) {
  const cacheKey = getCookieCacheKey(creds)
  const baseOrigin = getBaseOrigin()

  const cachedCookies = adminCookieCache.get(cacheKey)
  if (cachedCookies && cachedCookies.length > 0) {
    await page.context().addCookies(cachedCookies)
  }

  await page.goto('/admin/drug-test-upload', { waitUntil: 'domcontentloaded' })

  if (await waitForLoginForm(page, 1_500)) {
    adminCookieCache.delete(cacheKey)

    const apiLoginSucceeded = await loginAdminViaAPI(page, creds)
    if (apiLoginSucceeded) {
      await page.goto('/admin/drug-test-upload', { waitUntil: 'domcontentloaded' })
    }

    if (await waitForLoginForm(page, 3_500)) {
      await fillLoginForm(page, creds)
    }
  }

  let loginSucceeded = false
  try {
    await waitForAdminShell(page)
    loginSucceeded = true
  } catch {
    // Fallback: if the form is still visible, retry one more manual submit.
    if (await waitForLoginForm(page, 2_000)) {
      await fillLoginForm(page, creds)
      await waitForAdminShell(page)
      loginSucceeded = true
    }
  }

  if (!loginSucceeded && (await waitForLoginForm(page, 2_000))) {
    throw new Error(`Admin login failed for ${creds.email}; login form still visible after submission.`)
  }

  await expect(page).toHaveURL(/\/admin(\/drug-test-upload)?/i, { timeout: 20_000 })
  const freshCookies = await page.context().cookies(baseOrigin)
  if (freshCookies.length > 0) {
    adminCookieCache.set(cacheKey, freshCookies)
  }
}

export async function ensureAdminStorageState(args: {
  browser: Browser
  baseURL?: string
  creds: AdminCredentials
  stateFileName: string
}) {
  const authDir = path.resolve(process.cwd(), 'tests/e2e/.auth')
  const statePath = path.join(authDir, args.stateFileName)

  if (fs.existsSync(statePath)) {
    return statePath
  }

  fs.mkdirSync(authDir, { recursive: true })

  const context = await args.browser.newContext({
    baseURL: args.baseURL,
  })

  const page = await context.newPage()
  await loginAdmin(page, args.creds)
  await context.storageState({ path: statePath })
  await context.close()

  return statePath
}
