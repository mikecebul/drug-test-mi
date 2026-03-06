export const REDWOOD_BROWSER_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

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
