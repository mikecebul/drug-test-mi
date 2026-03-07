export const REDWOOD_BROWSER_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

export const DEFAULT_REDWOOD_LOGIN_URL = 'https://toxaccess.redwoodtoxicology.com/Pages/Public/Login.aspx'

export type RedwoodAuthEnv = {
  loginUrl: string
  password: string
  username: string
}

export type RedwoodBrowserSession = {
  browser: any
  context: any
  page: any
}

export async function loadPlaywrightModule(): Promise<any> {
  const dynamicImport = new Function('modulePath', 'return import(modulePath)') as (
    modulePath: string,
  ) => Promise<any>

  return dynamicImport('playwright')
}

export function normalizeRedwoodEnvCredential(rawValue: string | undefined): {
  value: string
  hadWrappingQuotes: boolean
} {
  if (typeof rawValue !== 'string') {
    return { value: '', hadWrappingQuotes: false }
  }

  const trimmed = rawValue.trim()
  const hasDoubleQuotes = trimmed.startsWith('"') && trimmed.endsWith('"')
  const hasSingleQuotes = trimmed.startsWith("'") && trimmed.endsWith("'")

  if (hasDoubleQuotes || hasSingleQuotes) {
    return {
      value: trimmed.slice(1, -1),
      hadWrappingQuotes: true,
    }
  }

  return { value: trimmed, hadWrappingQuotes: false }
}

export function resolveRedwoodPlaywrightLaunchOptions(overrides?: {
  headless?: boolean
  slowMoMs?: number
}): {
  headless: boolean
  slowMo?: number
} {
  const envHeadless = process.env.REDWOOD_PLAYWRIGHT_HEADLESS !== 'false'
  const headless = overrides?.headless ?? envHeadless
  const parsedSlowMo =
    typeof overrides?.slowMoMs === 'number'
      ? overrides.slowMoMs
      : Number.parseInt(process.env.REDWOOD_PLAYWRIGHT_SLOW_MO_MS || '0', 10)
  const slowMo = Number.isFinite(parsedSlowMo) && parsedSlowMo > 0 ? parsedSlowMo : undefined

  return {
    headless,
    slowMo,
  }
}

export async function openRedwoodBrowserContext(options?: {
  acceptDownloads?: boolean
  headless?: boolean
  slowMoMs?: number
}): Promise<RedwoodBrowserSession> {
  let playwright: any

  try {
    playwright = await loadPlaywrightModule()
  } catch {
    throw new Error('Playwright is not installed. Run `pnpm install` to install project dependencies.')
  }

  const launchOptions = resolveRedwoodPlaywrightLaunchOptions({
    headless: options?.headless,
    slowMoMs: options?.slowMoMs,
  })

  const browser = await playwright.chromium.launch({
    headless: launchOptions.headless,
    slowMo: launchOptions.slowMo,
    args: ['--disable-blink-features=AutomationControlled'],
  })

  const context = await browser.newContext({
    userAgent: REDWOOD_BROWSER_USER_AGENT,
    acceptDownloads: options?.acceptDownloads ?? false,
  })

  const page = await context.newPage()

  return { browser, context, page }
}

export async function fillFirstVisibleInput(page: any, selectors: string[], value: string): Promise<boolean> {
  for (const selector of selectors) {
    const locator = page.locator(selector)
    const count = await locator.count()
    if (count === 0) continue

    for (let i = 0; i < count; i++) {
      const candidate = locator.nth(i)
      try {
        if (!(await candidate.isVisible())) continue
        await candidate.click({ timeout: 2000 })
        await candidate.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A').catch(() => {})
        await candidate.press('Backspace').catch(() => {})
        await candidate.type(value, { delay: 25 })
        return true
      } catch {
        // Try next candidate
      }
    }
  }

  return false
}

export async function clickFirstVisible(page: any, selectors: string[]): Promise<boolean> {
  for (const selector of selectors) {
    const locator = page.locator(selector)
    const count = await locator.count()
    if (count === 0) continue

    for (let i = 0; i < count; i++) {
      const candidate = locator.nth(i)
      try {
        if (!(await candidate.isVisible())) continue
        await candidate.scrollIntoViewIfNeeded().catch(() => undefined)
        await candidate.click({ timeout: 2000 }).catch(async () => {
          await candidate.click({ timeout: 2000, force: true })
        })
        return true
      } catch {
        // Try next candidate
      }
    }
  }

  return false
}

export async function waitForAnyVisible(page: any, selectors: string[], timeoutMs: number): Promise<boolean> {
  const startedAt = Date.now()

  while (Date.now() - startedAt < timeoutMs) {
    for (const selector of selectors) {
      const locator = page.locator(selector)
      const count = await locator.count()
      if (count === 0) continue

      for (let i = 0; i < count; i++) {
        try {
          if (await locator.nth(i).isVisible()) {
            return true
          }
        } catch {
          // Continue polling
        }
      }
    }

    await page.waitForTimeout(300)
  }

  return false
}

export async function collectVisibleTexts(page: any, selectors: string[], limit = 5): Promise<string[]> {
  const collected: string[] = []

  for (const selector of selectors) {
    const locator = page.locator(selector)
    const count = await locator.count()
    if (count === 0) continue

    for (let i = 0; i < count; i++) {
      try {
        const candidate = locator.nth(i)
        if (!(await candidate.isVisible())) continue
        const text = (await candidate.textContent())?.trim()
        if (!text) continue
        collected.push(text)
        if (collected.length >= limit) {
          return collected
        }
      } catch {
        // Continue collecting
      }
    }
  }

  return collected
}

export async function dismissCookieBanner(page: any): Promise<void> {
  const acceptSelectors = [
    '#truste-consent-button',
    'button:has-text("Accept")',
    'button:has-text("I Accept")',
    'button:has-text("Accept All")',
    'button:has-text("Allow All")',
    'button[aria-label*="accept" i]',
    '#onetrust-accept-btn-handler',
    '.ot-sdk-container button:has-text("Accept")',
  ]

  for (let attempt = 0; attempt < 3; attempt++) {
    for (const selector of acceptSelectors) {
      const locator = page.locator(selector)
      const count = await locator.count()
      if (count === 0) continue

      for (let i = 0; i < count; i++) {
        const candidate = locator.nth(i)
        try {
          if (!(await candidate.isVisible())) continue
          await candidate.scrollIntoViewIfNeeded().catch(() => undefined)
          await candidate.click({ timeout: 2000 }).catch(async () => {
            await candidate.click({ timeout: 2000, force: true })
          })
          await page.waitForTimeout(400)
          const stillVisible = await candidate.isVisible().catch(() => false)
          if (!stillVisible) return
        } catch {
          // Try next candidate
        }
      }
    }

    await page
      .evaluate(() => {
        const selectors = [
          '#truste-consent-track',
          '#truste-consent-overlay',
          '#truste-consent-content',
          '#truste-show-consent',
          '#truste-consent-button',
          '#truste-consent-required',
        ]

        for (const selector of selectors) {
          const el = document.querySelector(selector)
          if (el?.parentElement) {
            el.parentElement.removeChild(el)
          } else if (el) {
            el.remove()
          }
        }
      })
      .catch(() => undefined)
  }
}

async function submitRedwoodLoginFormFallback(page: any): Promise<boolean> {
  return await page.evaluate(() => {
    const passwordField =
      (document.querySelector('input[type="password"]') as HTMLInputElement | null) ||
      (document.querySelector('input[name*="Password"]') as HTMLInputElement | null) ||
      (document.querySelector('input[id*="Password"]') as HTMLInputElement | null)

    if (!passwordField) return false

    const form = passwordField.form || (document.querySelector('form') as HTMLFormElement | null)
    if (!form) return false

    if (typeof form.requestSubmit === 'function') {
      form.requestSubmit()
      return true
    }

    form.submit()
    return true
  })
}

async function submitRedwoodLoginWithPostBack(page: any): Promise<boolean> {
  return await page.evaluate(() => {
    const win = window as unknown as { __doPostBack?: (eventTarget: string, eventArgument: string) => void }
    if (typeof win.__doPostBack !== 'function') return false

    const targets = [
      'ctl00$PageContent$Login1$LoginButtonMembership',
      'ctl00$PageContent$Login1$LoginButton',
      'ctl00$PageContent$Login1$LoginImageButton',
      'PageContent$Login1$LoginButton',
    ]

    for (const target of targets) {
      try {
        win.__doPostBack(target, '')
        return true
      } catch {
        // Try next target.
      }
    }

    return false
  })
}

async function submitRedwoodLoginWithEnter(page: any): Promise<boolean> {
  for (const selector of ['input[name*="Password"]', 'input[id*="Password"]', 'input[type="password"]']) {
    const locator = page.locator(selector)
    const count = await locator.count()

    for (let i = 0; i < count; i++) {
      const field = locator.nth(i)

      try {
        if (!(await field.isVisible())) continue
        await field.press('Enter')
        return true
      } catch {
        // Try next password field.
      }
    }
  }

  return false
}

export function resolveRedwoodAuthEnv(): RedwoodAuthEnv {
  const username = normalizeRedwoodEnvCredential(process.env.REDWOOD_USERNAME).value
  const password = normalizeRedwoodEnvCredential(process.env.REDWOOD_PASSWORD).value
  const loginUrl = process.env.REDWOOD_LOGIN_URL?.trim() || DEFAULT_REDWOOD_LOGIN_URL

  if (!username) {
    throw new Error('Missing required environment variable: REDWOOD_USERNAME')
  }

  if (!password) {
    throw new Error('Missing required environment variable: REDWOOD_PASSWORD')
  }

  return {
    loginUrl,
    password,
    username,
  }
}

export async function loginToRedwood(page: any, auth: RedwoodAuthEnv): Promise<void> {
  const { loginUrl, password, username } = auth

  await page.goto(loginUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await dismissCookieBanner(page)

  const usernameFilled = await fillFirstVisibleInput(
    page,
    [
      '#PageContent_Login1_UserName',
      'input[name="ctl00$PageContent$Login1$UserName"]',
      'input[name*="UserName"]',
      'input[id*="UserName"]',
      'input[placeholder*="User"]',
      'input[type="text"]',
    ],
    username,
  )

  if (!usernameFilled) {
    throw new Error('Unable to find Redwood username field')
  }

  const passwordFilled = await fillFirstVisibleInput(
    page,
    [
      '#PageContent_Login1_Password',
      'input[name="ctl00$PageContent$Login1$Password"]',
      'input[name*="Password"]',
      'input[id*="Password"]',
      'input[type="password"]',
    ],
    password,
  )

  if (!passwordFilled) {
    throw new Error('Unable to find Redwood password field')
  }

  const clickedLogin = await clickFirstVisible(page, [
    '#PageContent_Login1_LoginButtonMembership',
    'input[name="ctl00$PageContent$Login1$LoginButtonMembership"]',
    '#PageContent_Login1_LoginButton',
    'input[name="ctl00$PageContent$Login1$LoginButton"]',
    'button:has-text("LOGIN")',
    'button:has-text("Login")',
    'input[id*="Login"]',
    'input[id*="login"]',
    'input[name*="Login"]',
    'input[name*="login"]',
    'input[type="submit"][value*="LOGIN"]',
    'input[type="submit"][value*="Login"]',
    'input[type="button"][value*="LOGIN"]',
    'input[type="button"][value*="Login"]',
    'a:has-text("LOGIN")',
    'a:has-text("Login")',
    'button[type="submit"]',
    '[role="button"]:has-text("LOGIN")',
    '[role="button"]:has-text("Login")',
  ]).catch(() => false)

  await page.waitForTimeout(1500)

  let loginSubmitAttempted = clickedLogin

  if (page.url().includes('/Pages/Public/Login.aspx')) {
    const submittedByForm = await submitRedwoodLoginFormFallback(page)
    loginSubmitAttempted = submittedByForm

    if (!loginSubmitAttempted) {
      loginSubmitAttempted = await submitRedwoodLoginWithPostBack(page)
    }

    if (!loginSubmitAttempted) {
      loginSubmitAttempted = await submitRedwoodLoginWithEnter(page)
    }

    if (!loginSubmitAttempted) {
      const diagnostic = await page.evaluate(() => {
        const formCount = document.querySelectorAll('form').length
        const submitControlCount = document.querySelectorAll(
          'button, input[type="submit"], input[type="button"], [role="button"], a',
        ).length

        return { formCount, submitControlCount, title: document.title, url: window.location.href }
      })

      throw new Error(
        `Unable to submit Redwood login form (forms=${diagnostic.formCount}, controls=${diagnostic.submitControlCount}, title="${diagnostic.title}", url="${diagnostic.url}")`,
      )
    }

    await page.waitForTimeout(1500)
  }

  const loginFailed = await page
    .locator(
      '.validation-summary-errors, .login-error, #PageContent_Login1_FailureText, [id*="FailureText"], [class*="error"]',
    )
    .first()
    .isVisible()
    .catch(() => false)

  if (loginFailed) {
    const errorText =
      (await page
        .locator('.validation-summary-errors, .login-error, #PageContent_Login1_FailureText, [id*="FailureText"]')
        .first()
        .textContent()
        .catch(() => null)) || 'Unknown Redwood login failure'

    throw new Error(`Redwood login failed: ${errorText}`)
  }

  await page.waitForLoadState('domcontentloaded', { timeout: 20000 })
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {})
  await page.waitForTimeout(1200)
}
