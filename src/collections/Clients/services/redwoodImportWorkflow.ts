import fs from 'node:fs/promises'
import path from 'node:path'

import type { Payload } from 'payload'

import { createAdminAlert } from '@/lib/admin-alerts'
import {
  buildRedwoodImportCSV,
  findRedwoodDonorMatch,
  parseRedwoodExport,
  type RedwoodMatchBy,
} from '@/lib/redwood/csv'
import { buildRedwoodUniqueId } from '@/lib/redwood/unique-id'

const DEFAULT_REDWOOD_LOGIN_URL = 'https://toxaccess.redwoodtoxicology.com/Pages/Public/Login.aspx'
const DEFAULT_REDWOOD_EXPORT_URL = 'https://toxaccess.redwoodtoxicology.com/Pages/User/ExportDonors.aspx'
const DEFAULT_REDWOOD_IMPORT_URL = 'https://toxaccess.redwoodtoxicology.com/Pages/User/ImportDonors.aspx'
const DEFAULT_ACCOUNT_NUMBER = '310872'
const REDWOOD_IMPORT_PREVIEW_ONLY = true

async function loadPlaywrightModule(): Promise<any> {
  const dynamicImport = new Function('modulePath', 'return import(modulePath)') as (
    modulePath: string,
  ) => Promise<any>
  return dynamicImport('playwright')
}

function normalizeEnvCredential(rawValue: string | undefined): string {
  if (typeof rawValue !== 'string') {
    return ''
  }

  const trimmed = rawValue.trim()
  const hasDoubleQuotes = trimmed.startsWith('"') && trimmed.endsWith('"')
  const hasSingleQuotes = trimmed.startsWith("'") && trimmed.endsWith("'")

  if (hasDoubleQuotes || hasSingleQuotes) {
    return trimmed.slice(1, -1)
  }

  return trimmed
}

function resolvePlaywrightLaunchOptions(overrides?: {
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

async function fillFirstVisibleInput(page: any, selectors: string[], value: string): Promise<boolean> {
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
        // try next selector
      }
    }
  }

  return false
}

async function clickFirstVisible(page: any, selectors: string[]): Promise<boolean> {
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
        // try next selector
      }
    }
  }

  return false
}

async function waitForAnyVisible(page: any, selectors: string[], timeoutMs: number): Promise<boolean> {
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
          // continue polling
        }
      }
    }

    await page.waitForTimeout(300)
  }

  return false
}

async function collectVisibleTexts(page: any, selectors: string[], limit = 5): Promise<string[]> {
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
        // continue collecting
      }
    }
  }

  return collected
}

async function dismissCookieBanner(page: any): Promise<void> {
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
          // try next candidate
        }
      }
    }

    // Last-resort cleanup for sticky consent overlays that intercept clicks.
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

async function collectActionControls(page: any, limit = 12): Promise<string[]> {
  const controls = await page
    .locator('input[type="submit"], input[type="button"], button, a[onclick*="__doPostBack"]')
    .evaluateAll((elements, max) => {
      const results: string[] = []
      for (const el of elements) {
        if (results.length >= max) break
        const inputEl = el as HTMLInputElement
        const tag = el.tagName.toLowerCase()
        const type = inputEl.type || ''
        const id = el.getAttribute('id') || ''
        const name = el.getAttribute('name') || ''
        const value = inputEl.value || ''
        const text = (el.textContent || '').trim().slice(0, 80)
        const visible = !!(
          (el as HTMLElement).offsetWidth ||
          (el as HTMLElement).offsetHeight ||
          (el as HTMLElement).getClientRects().length
        )
        results.push(`${tag}[type=${type}] id=${id} name=${name} value=${value} text=${text} visible=${visible}`)
      }
      return results
    }, limit)
    .catch(() => [] as string[])

  return controls
}

async function submitContainingForm(fileInput: any): Promise<boolean> {
  return fileInput
    .evaluate((input: HTMLInputElement) => {
      const form = input.form
      if (!form) return false
      if (typeof form.requestSubmit === 'function') {
        form.requestSubmit()
        return true
      }
      form.submit()
      return true
    })
    .catch(() => false)
}

async function loginToRedwood(args: {
  page: any
  loginUrl: string
  username: string
  password: string
}): Promise<void> {
  const { page, loginUrl, username, password } = args

  await page.goto(loginUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await dismissCookieBanner(page)

  const usernameFilled = await fillFirstVisibleInput(
    page,
    [
      '#PageContent_Login1_UserName',
      'input[name="ctl00$PageContent$Login1$UserName"]',
      'input[name*="UserName"]',
      'input[id*="UserName"]',
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
    '#PageContent_Login1_LoginButton',
    'button[type="submit"]',
    'input[type="submit"][value*="LOGIN"]',
    'input[type="submit"][value*="Login"]',
    'input[type="button"][value*="LOGIN"]',
    'input[type="button"][value*="Login"]',
  ])

  if (!clickedLogin) {
    const submitted = await page.evaluate(() => {
      const form = (document.querySelector('input[type="password"]') as HTMLInputElement | null)?.form
      if (!form) return false
      if (typeof form.requestSubmit === 'function') {
        form.requestSubmit()
        return true
      }
      form.submit()
      return true
    })

    if (!submitted) {
      throw new Error('Unable to submit Redwood login form')
    }
  }

  await page.waitForTimeout(1500)

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
}

async function downloadExportCSV(args: {
  page: any
  exportUrl: string
  outputDir: string
}): Promise<{ csv: string; csvPath: string }> {
  const { page, exportUrl, outputDir } = args

  await page.goto(exportUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await dismissCookieBanner(page)

  const exportSelectors = [
    '#PageContent_ExportDonorsButton',
    'input[id*="Export"]',
    'input[name*="Export"]',
    'button:has-text("Export")',
    'a:has-text("Export")',
  ]

  const downloadPromise = page.waitForEvent('download', { timeout: 30000 })

  const clicked = await clickFirstVisible(page, exportSelectors)
  if (!clicked) {
    throw new Error('Unable to locate Redwood donor export control')
  }

  const download = await downloadPromise

  const exportPath = path.join(outputDir, 'exports', `redwood-donor-export-${Date.now()}.csv`)
  await fs.mkdir(path.dirname(exportPath), { recursive: true })
  await download.saveAs(exportPath)

  const csv = await fs.readFile(exportPath, 'utf8')
  if (!csv.trim()) {
    throw new Error('Redwood donor export CSV was empty')
  }

  return { csv, csvPath: exportPath }
}

function buildMatchedDonorName(match: {
  donor: {
    firstName: string | null
    lastName: string | null
    email: string | null
    uniqueId: string | null
  }
}): string {
  const fullName = [match.donor.firstName, match.donor.lastName].filter(Boolean).join(' ').trim()
  return fullName || match.donor.email || match.donor.uniqueId || 'Existing Redwood donor'
}

function mapSex(gender: string | null | undefined): string {
  if (!gender) return ''
  const normalized = gender.toLowerCase()
  if (normalized === 'male') return 'M'
  if (normalized === 'female') return 'F'
  return ''
}

function normalizePhoneForRedwood(phone: string | null | undefined): string {
  const raw = (phone || '').trim()
  if (!raw) return ''

  const digits = raw.replace(/\D/g, '')
  if (digits.length === 11 && digits.startsWith('1')) {
    return digits.slice(1)
  }

  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`
  }

  return ''
}

function formatDateToMMDDYYYY(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const year = String(date.getFullYear())
  return `${month}/${day}/${year}`
}

async function extractRedwoodServerDate(page: any): Promise<string | null> {
  const bodyText = (await page.textContent('body').catch(() => null)) || ''
  const dayNameMatch = bodyText.match(
    /\b(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),\s*([A-Za-z]+\s+\d{1,2},\s+\d{4})\b/i,
  )

  const dateText = dayNameMatch?.[1]
  if (!dateText) return null

  const parsed = new Date(dateText)
  if (Number.isNaN(parsed.getTime())) return null
  return formatDateToMMDDYYYY(parsed)
}

function resolveDonorGroup(donors: Array<{ raw: Record<string, string> }>): string {
  const envGroup = (process.env.REDWOOD_DONOR_GROUP || '').trim()
  if (envGroup) {
    return envGroup
  }

  const keys = ['donorgroup', 'group']
  const counts = new Map<string, number>()

  for (const donor of donors) {
    for (const key of keys) {
      const value = (donor.raw[key] || '').trim()
      if (!value) continue
      counts.set(value, (counts.get(value) || 0) + 1)
    }
  }

  if (counts.size === 0) return ''

  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1])
  return sorted[0][0]
}

async function updateClientRedwoodState(payload: Payload, clientId: string, data: Record<string, unknown>) {
  await payload.update({
    collection: 'clients',
    id: clientId,
    data,
    overrideAccess: true,
  })
}

export async function runRedwoodImportClientJob(args: {
  payload: Payload
  clientId: string
  source: string
  playwrightHeadless?: boolean
  playwrightSlowMoMs?: number
}): Promise<{
  status: string
  matchedBy?: RedwoodMatchBy
  screenshotPath?: string
}> {
  const { payload, clientId, source, playwrightHeadless, playwrightSlowMoMs } = args
  const outputDir = path.resolve(process.cwd(), 'output', 'redwood')

  const username = normalizeEnvCredential(process.env.REDWOOD_USERNAME)
  const password = normalizeEnvCredential(process.env.REDWOOD_PASSWORD)
  const loginUrl = process.env.REDWOOD_LOGIN_URL?.trim() || DEFAULT_REDWOOD_LOGIN_URL
  const exportUrl = process.env.REDWOOD_EXPORT_URL?.trim() || DEFAULT_REDWOOD_EXPORT_URL
  const importUrl = process.env.REDWOOD_IMPORT_URL?.trim() || DEFAULT_REDWOOD_IMPORT_URL

  if (!username) {
    throw new Error('Missing required environment variable: REDWOOD_USERNAME')
  }

  if (!password) {
    throw new Error('Missing required environment variable: REDWOOD_PASSWORD')
  }

  const client = await payload.findByID({
    collection: 'clients',
    id: clientId,
    depth: 0,
    overrideAccess: true,
  })

  if (!client?.firstName || !client?.lastName || !client?.dob) {
    throw new Error('Client is missing required fields for Redwood import (firstName, lastName, dob)')
  }

  const uniqueId = (typeof client.redwoodUniqueId === 'string' && client.redwoodUniqueId.trim()) || buildRedwoodUniqueId(client.id)

  await updateClientRedwoodState(payload, client.id, {
    redwoodUniqueId: uniqueId,
    redwoodSyncStatus: 'export-checked',
    redwoodLastAttemptAt: new Date().toISOString(),
    redwoodLastError: null,
  })

  let browser: any
  let context: any
  let page: any
  let diagnosticScreenshotPath: string | null = null

  try {
    const playwright = await loadPlaywrightModule()
    const launchOptions = resolvePlaywrightLaunchOptions({
      headless: playwrightHeadless,
      slowMoMs: playwrightSlowMoMs,
    })
    browser = await playwright.chromium.launch({
      headless: launchOptions.headless,
      slowMo: launchOptions.slowMo,
      args: ['--disable-blink-features=AutomationControlled'],
    })

    context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      acceptDownloads: true,
    })

    page = await context.newPage()

    await loginToRedwood({
      page,
      loginUrl,
      username,
      password,
    })

    const { csv, csvPath } = await downloadExportCSV({
      page,
      exportUrl,
      outputDir,
    })
    const redwoodServerDate = await extractRedwoodServerDate(page)

    const donors = parseRedwoodExport(csv)
    const donorMatch = findRedwoodDonorMatch(donors, {
      uniqueId,
      firstName: client.firstName,
      middleInitial: client.middleInitial || null,
      lastName: client.lastName,
      dob: client.dob,
    })

    payload.logger.info({
      msg: '[redwood-import] Export parsed',
      clientId,
      source,
      csvPath,
      donorCount: donors.length,
      matchedBy: donorMatch?.matchedBy,
    })

    if (donorMatch) {
      await updateClientRedwoodState(payload, client.id, {
        redwoodSyncStatus: 'matched-existing',
        redwoodMatchedBy: donorMatch.matchedBy,
        redwoodMatchedDonorName: buildMatchedDonorName(donorMatch),
        redwoodLastAttemptAt: new Date().toISOString(),
        redwoodLastError: null,
      })

      return {
        status: 'matched-existing',
        matchedBy: donorMatch.matchedBy,
      }
    }

    const donorGroup = resolveDonorGroup(donors)

    const importCsvContent = buildRedwoodImportCSV({
      accountNumber: DEFAULT_ACCOUNT_NUMBER,
      firstName: client.firstName,
      middleInitial: client.middleInitial || '',
      lastName: client.lastName,
      uniqueId,
      dob: client.dob,
      intakeDate: redwoodServerDate || client.dob,
      sex: mapSex(client.gender),
      phoneNumber: normalizePhoneForRedwood(client.phone || ''),
      group: donorGroup,
    })

    const importCsvPath = path.join(outputDir, 'imports', `redwood-import-${client.id}-${Date.now()}.csv`)
    await fs.mkdir(path.dirname(importCsvPath), { recursive: true })
    await fs.writeFile(importCsvPath, importCsvContent, 'utf8')

    await page.goto(importUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await dismissCookieBanner(page)

    if (REDWOOD_IMPORT_PREVIEW_ONLY) {
      const screenshotPath = path.join(outputDir, 'screenshots', `redwood-import-staged-${client.id}-${Date.now()}.png`)
      await fs.mkdir(path.dirname(screenshotPath), { recursive: true })
      await dismissCookieBanner(page)
      await page.screenshot({ path: screenshotPath, fullPage: true })

      await updateClientRedwoodState(payload, client.id, {
        redwoodSyncStatus: 'ready-to-submit',
        redwoodMatchedBy: null,
        redwoodMatchedDonorName: null,
        redwoodImportScreenshotPath: screenshotPath,
        redwoodLastAttemptAt: new Date().toISOString(),
        redwoodLastError: null,
      })

      payload.logger.info({
        msg: '[redwood-import] Preview-only mode: skipped file selection/upload and captured screenshot',
        clientId,
        source,
        importCsvPath,
        screenshotPath,
        queue: 'redwood',
      })

      return {
        status: 'ready-to-submit',
        screenshotPath,
      }
    }

    const fileInput = page
      .locator('input[type="file"], input[id*="File"], input[name*="File"]')
      .first()

    if ((await fileInput.count()) === 0) {
      throw new Error('Unable to find Redwood import file input on ImportDonors page')
    }

    await fileInput.setInputFiles(importCsvPath)
    await dismissCookieBanner(page)

    const submitSelectors = [
      'input[id*="Submit"]',
      'input[name*="Submit"]',
      'input[type="submit"][value*="Submit"]',
      'button:has-text("Submit")',
    ]

    // Some Redwood variants auto-upload after selecting the file.
    let submitVisible = await waitForAnyVisible(page, submitSelectors, 5000)

    let uploadClicked = false
    if (!submitVisible) {
      const explicitUpload = page.locator('#PageContent_ImportDonor1_btnImport').first()
      const explicitCount = await explicitUpload.count()
      if (explicitCount > 0) {
        uploadClicked = await explicitUpload
          .scrollIntoViewIfNeeded()
          .then(async () => {
            await explicitUpload.click({ timeout: 2000 }).catch(async () => {
              await explicitUpload.click({ timeout: 2000, force: true })
            })
            return true
          })
          .catch(() => false)
      }
    }

    if (!submitVisible && !uploadClicked) {
      uploadClicked = await clickFirstVisible(page, [
        'input[type="submit"][id*="Upload"]',
        'input[type="submit"][name*="Upload"]',
        'input[type="submit"][value*="Upload"]',
        'input[type="button"][id*="Upload"]',
        'input[type="button"][name*="Upload"]',
        'input[type="button"][value*="Upload"]',
        'input[type="submit"][id*="Import"]',
        'input[type="submit"][name*="Import"]',
        'button[id*="Upload"]',
        'button[name*="Upload"]',
        'input[type="submit"][value*="Import"]',
        'input[type="button"][value*="Import"]',
        'input[type="submit"][value*="Process"]',
        'input[type="submit"][value*="Continue"]',
        'input[type="submit"][value*="Next"]',
        'button:has-text("Process")',
        'button:has-text("Continue")',
        'button:has-text("Next")',
        'button:has-text("Upload")',
        'button:has-text("Import")',
      ])
    }

    if (!submitVisible && uploadClicked) {
      submitVisible = await waitForAnyVisible(page, submitSelectors, 120000)
    }

    // If we still haven't reached submit-ready state and could not click a known upload control,
    // try submitting the containing form directly as a fallback.
    if (!submitVisible && !uploadClicked) {
      const formSubmitted = await submitContainingForm(fileInput)
      if (formSubmitted) {
        submitVisible = await waitForAnyVisible(page, submitSelectors, 15000)
      }
    }

    if (!submitVisible && !uploadClicked) {
      diagnosticScreenshotPath = path.join(
        outputDir,
        'screenshots',
        `redwood-import-upload-missing-${client.id}-${Date.now()}.png`,
      )
      await fs.mkdir(path.dirname(diagnosticScreenshotPath), { recursive: true })
      await page.screenshot({ path: diagnosticScreenshotPath, fullPage: true }).catch(() => undefined)
      const controls = await collectActionControls(page, 12)

      throw new Error(
        `Unable to find Redwood import upload action. currentUrl=${page.url()} controls=${controls.join(' || ')} screenshotPath=${diagnosticScreenshotPath}`,
      )
    }

    if (!submitVisible) {
      const importTextareaText = await page
        .locator('textarea')
        .first()
        .inputValue()
        .catch(async () => {
          return (
            (await page.locator('textarea').first().textContent().catch(() => null)) ||
            ''
          ).trim()
        })

      const pageText = ((await page.textContent('body').catch(() => null)) || '').trim()
      const rejectionSummary = `${importTextareaText}\n${pageText}`.toLowerCase()
      const hasImportRejection =
        rejectionSummary.includes('rejected record') ||
        rejectionSummary.includes('donor(s) rejected') ||
        rejectionSummary.includes('reason 1') ||
        rejectionSummary.includes('invalid ')

      if (hasImportRejection) {
        diagnosticScreenshotPath = path.join(
          outputDir,
          'screenshots',
          `redwood-import-rejected-${client.id}-${Date.now()}.png`,
        )
        await fs.mkdir(path.dirname(diagnosticScreenshotPath), { recursive: true })
        await dismissCookieBanner(page)
        await page.screenshot({ path: diagnosticScreenshotPath, fullPage: true }).catch(() => undefined)

        const rejectionDetails = importTextareaText
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean)
          .slice(0, 10)
          .join(' | ')

        await updateClientRedwoodState(payload, client.id, {
          redwoodSyncStatus: 'manual-review',
          redwoodMatchedBy: null,
          redwoodMatchedDonorName: null,
          redwoodImportScreenshotPath: diagnosticScreenshotPath,
          redwoodLastAttemptAt: new Date().toISOString(),
          redwoodLastError: rejectionDetails || 'Redwood import rejected row(s).',
        })

        await createAdminAlert(payload, {
          severity: 'high',
          alertType: 'data-integrity',
          title: `Redwood import rejected row(s) for client ${client.id}`,
          message: rejectionDetails || 'Redwood rejected one or more import rows. Manual review required.',
          context: {
            clientId: client.id,
            source,
            queue: 'redwood',
            screenshotPath: diagnosticScreenshotPath,
          },
        })

        payload.logger.warn({
          msg: '[redwood-import] Import rejected rows; routing to manual review',
          clientId,
          source,
          screenshotPath: diagnosticScreenshotPath,
          rejectionDetails,
          queue: 'redwood',
        })

        return {
          status: 'manual-review',
          screenshotPath: diagnosticScreenshotPath,
        }
      }

      diagnosticScreenshotPath = path.join(
        outputDir,
        'screenshots',
        `redwood-import-submit-missing-${client.id}-${Date.now()}.png`,
      )
      await fs.mkdir(path.dirname(diagnosticScreenshotPath), { recursive: true })
      await page.screenshot({ path: diagnosticScreenshotPath, fullPage: true }).catch(() => undefined)

      const visibleErrors = await collectVisibleTexts(
        page,
        [
          '.validation-summary-errors',
          '.validation-summary-valid',
          '.error',
          '[class*="error"]',
          '[id*="Error"]',
          '[id*="Validation"]',
        ],
        3,
      )

      const details = [
        `currentUrl=${page.url()}`,
        `visibleErrors=${visibleErrors.length > 0 ? visibleErrors.join(' | ') : 'none'}`,
        `screenshotPath=${diagnosticScreenshotPath}`,
      ].join(' ')

      throw new Error(`Redwood import did not reach submit-ready state. ${details}`)
    }

    const screenshotPath = path.join(outputDir, 'screenshots', `redwood-import-ready-${client.id}-${Date.now()}.png`)
    await fs.mkdir(path.dirname(screenshotPath), { recursive: true })
    await page.screenshot({ path: screenshotPath, fullPage: true })

    await updateClientRedwoodState(payload, client.id, {
      redwoodSyncStatus: 'ready-to-submit',
      redwoodMatchedBy: null,
      redwoodMatchedDonorName: null,
      redwoodImportScreenshotPath: screenshotPath,
      redwoodLastAttemptAt: new Date().toISOString(),
      redwoodLastError: null,
    })

    payload.logger.info({
      msg: '[redwood-import] Reached submit-ready state without submitting',
      clientId,
      source,
      screenshotPath,
      queue: 'redwood',
    })

    return {
      status: 'ready-to-submit',
      screenshotPath,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)

    const failedState: Record<string, unknown> = {
      redwoodSyncStatus: 'failed',
      redwoodLastAttemptAt: new Date().toISOString(),
      redwoodLastError: errorMessage,
    }

    if (diagnosticScreenshotPath) {
      failedState.redwoodImportScreenshotPath = diagnosticScreenshotPath
    }

    await updateClientRedwoodState(payload, client.id, failedState)

    await createAdminAlert(payload, {
      severity: 'high',
      alertType: 'data-integrity',
      title: `Redwood import job failed for client ${client.id}`,
      message: errorMessage,
      context: {
        clientId: client.id,
        source,
        queue: 'redwood',
        screenshotPath: diagnosticScreenshotPath,
      },
    })

    throw error
  } finally {
    await page?.close().catch(() => undefined)
    await context?.close().catch(() => undefined)
    await browser?.close().catch(() => undefined)
  }
}
