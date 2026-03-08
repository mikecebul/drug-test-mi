import fs from 'node:fs/promises'
import path from 'node:path'

import type { Payload } from 'payload'

import { createAdminAlert } from '@/lib/admin-alerts'
import { formatDateForRedwood, mapGenderToRedwoodSex, normalizePhoneForRedwood } from '@/lib/redwood/client-fields'
import { assertRedwoodMutationAllowed, getRedwoodAccountNumber } from '@/lib/redwood/config'
import {
  buildRedwoodImportCSV,
  extractRedwoodCallInCode,
  findRedwoodDonorMatch,
  parseRedwoodExport,
  type RedwoodExportDonor,
  type RedwoodMatchBy,
} from '@/lib/redwood/csv'
import { resolveRedwoodDonorMatch } from '@/lib/redwood/donor-search'
import {
  type RedwoodBrowserRuntimeProfile,
  clickFirstVisible,
  collectVisibleTexts,
  dismissCookieBanner,
  loginToRedwood,
  resolveRedwoodAuthEnv,
  waitForAnyVisible,
  withRedwoodBrowserSession,
} from '@/lib/redwood/playwright'
import { mapReferralTypeToRedwoodGroup } from '@/lib/redwood/groups'
import { buildRedwoodUniqueId } from '@/lib/redwood/unique-id'
import { runRedwoodDefaultTestSync } from './redwoodDefaultTestSync'

const DEFAULT_REDWOOD_EXPORT_URL = 'https://toxaccess.redwoodtoxicology.com/Pages/User/ExportDonors.aspx'
const DEFAULT_REDWOOD_IMPORT_URL = 'https://toxaccess.redwoodtoxicology.com/Pages/User/ImportDonors.aspx'
const DEFAULT_REDWOOD_DONOR_SEARCH_URL = 'https://toxaccess.redwoodtoxicology.com/Pages/User/DonorSearch.aspx'

function isRedwoodImportPreviewOnly(): boolean {
  return process.env.REDWOOD_IMPORT_PREVIEW_ONLY === 'true'
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

async function settleAfterRedwoodFormAction(page: any): Promise<void> {
  await page.waitForLoadState('domcontentloaded', { timeout: 10000 }).catch(() => undefined)
  await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => undefined)
  await page.waitForTimeout(800)
  await dismissCookieBanner(page)
}

async function didImportPageAdvance(args: {
  page: any
  submitSelectors: string[]
}): Promise<boolean> {
  const { page, submitSelectors } = args
  const reviewState = await readImportReviewState(page)
  if (reviewState.importTextareaText.trim()) {
    return true
  }

  return waitForAnyVisible(page, submitSelectors, 500)
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

  const downloadPromise = page.waitForEvent('download', { timeout: 30000 }).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Redwood donor export download did not start: ${message}`)
  })

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

async function extractRedwoodServerDate(page: any): Promise<string | null> {
  const bodyText = (await page.textContent('body').catch(() => null)) || ''
  const dayNameMatch = bodyText.match(
    /\b(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),\s*([A-Za-z]+\s+\d{1,2},\s+\d{4})\b/i,
  )

  const dateText = dayNameMatch?.[1]
  if (!dateText) return null

  const parsed = new Date(dateText)
  if (Number.isNaN(parsed.getTime())) return null
  return formatDateForRedwood(parsed)
}

function resolveDonorGroup(args: {
  clientReferralType?: string | null
  donors: Array<{ raw: Record<string, string> }>
}): string {
  const { clientReferralType, donors } = args
  const referralGroup = mapReferralTypeToRedwoodGroup(clientReferralType)
  if (referralGroup) return referralGroup

  const envGroup = (process.env.REDWOOD_DONOR_GROUP || '').trim()
  if (envGroup) return envGroup

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

function isImportProcessedSummary(summary: string): boolean {
  return (
    summary.includes('imported successfully') ||
    summary.includes('donor(s) added') ||
    summary.includes('donor(s) updated') ||
    summary.includes('records processed') ||
    summary.includes('processed successfully')
  )
}

function filterDonorsByAccountNumber<T extends { raw: Record<string, string> }>(donors: T[], accountNumber: string): T[] {
  return donors.filter((donor) => {
    const agencyNumber = donor.raw.agencynumber?.trim() || donor.raw.accountnumber?.trim() || ''
    return agencyNumber === accountNumber
  })
}

async function updateClientRedwoodState(payload: Payload, clientId: string, data: Record<string, unknown>) {
  await payload.update({
    collection: 'clients',
    id: clientId,
    data,
    overrideAccess: true,
  })
}

function isImportRejectionSummary(summary: string): boolean {
  const rejectedCount = summary.match(/(\d+)\s+donor\(s\)\s+rejected/)?.[1]
  const hasRejectedRows = rejectedCount ? Number.parseInt(rejectedCount, 10) > 0 : false

  return (
    hasRejectedRows ||
    summary.includes('rejected record') ||
    summary.includes('rejected records') ||
    summary.includes('reason 1') ||
    summary.includes('import rejected') ||
    summary.includes('failed record') ||
    summary.includes('records failed')
  )
}

function buildImportRejectionDetails(importTextareaText: string): string {
  return importTextareaText
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 10)
    .join(' | ')
}

async function readImportReviewState(page: any): Promise<{
  importTextareaText: string
  summary: string
}> {
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

  return {
    importTextareaText,
    summary: `${importTextareaText}\n${pageText}`.toLowerCase(),
  }
}

async function triggerRedwoodImportUpload(args: {
  fileInput: any
  page: any
  submitSelectors: string[]
}): Promise<boolean> {
  const { fileInput, page, submitSelectors } = args
  const explicitUpload = page.locator('#PageContent_ImportDonor1_btnImport').first()
  const explicitCount = await explicitUpload.count()

  if (explicitCount > 0) {
    const clicked = await explicitUpload
      .scrollIntoViewIfNeeded()
      .then(async () => {
        await explicitUpload.click({ timeout: 2000 }).catch(async () => {
          await explicitUpload.click({ timeout: 2000, force: true })
        })
        return true
      })
      .catch(() => false)

    if (clicked) {
      await settleAfterRedwoodFormAction(page)
      if (await didImportPageAdvance({ page, submitSelectors })) {
        return true
      }
    }

    const nativeClicked = await explicitUpload
      .evaluate((button: HTMLInputElement | HTMLButtonElement) => {
        button.click()
        return true
      })
      .catch(() => false)

    if (nativeClicked) {
      await settleAfterRedwoodFormAction(page)
      if (await didImportPageAdvance({ page, submitSelectors })) {
        return true
      }
    }

    const postBackSubmitted = await page
      .evaluate(() => {
        const win = window as unknown as { __doPostBack?: (eventTarget: string, eventArgument: string) => void }
        if (typeof win.__doPostBack !== 'function') return false

        const targets = [
          'ctl00$PageContent$ImportDonor1$btnImport',
          'PageContent$ImportDonor1$btnImport',
          'PageContent_ImportDonor1_btnImport',
        ]

        for (const target of targets) {
          try {
            win.__doPostBack(target, '')
            return true
          } catch {
            // Try the next target.
          }
        }

        return false
      })
      .catch(() => false)

    if (postBackSubmitted) {
      await settleAfterRedwoodFormAction(page)
      if (await didImportPageAdvance({ page, submitSelectors })) {
        return true
      }
    }
  }

  const clickedFallback = await clickFirstVisible(page, [
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

  if (clickedFallback) {
    await settleAfterRedwoodFormAction(page)
    if (await didImportPageAdvance({ page, submitSelectors })) {
      return true
    }
  }

  const formSubmitted = await submitContainingForm(fileInput)
  if (formSubmitted) {
    await settleAfterRedwoodFormAction(page)
    if (await didImportPageAdvance({ page, submitSelectors })) {
      return true
    }
  }

  return false
}

async function triggerRedwoodImportSubmit(args: {
  page: any
  submitSelectors: string[]
}): Promise<boolean> {
  const { page, submitSelectors } = args
  const clicked = await clickFirstVisible(page, submitSelectors)
  if (clicked) {
    await settleAfterRedwoodFormAction(page)
    return true
  }

  const domSubmitted = await page
    .evaluate(() => {
      const isVisible = (element: Element): boolean => {
        const htmlElement = element as HTMLElement
        return !!(htmlElement.offsetWidth || htmlElement.offsetHeight || htmlElement.getClientRects().length)
      }

      const getControlText = (element: Element): string => {
        const inputElement = element as HTMLInputElement
        return `${inputElement.value || ''} ${element.textContent || ''}`.trim().toLowerCase()
      }

      const canSubmitControl = (element: Element): boolean => {
        const text = getControlText(element)
        return ['submit', 'finish', 'complete', 'continue', 'import'].some((fragment) => text.includes(fragment))
      }

      const win = window as unknown as { __doPostBack?: (eventTarget: string, eventArgument: string) => void }
      const candidates = Array.from(
        document.querySelectorAll('input[type="submit"], input[type="button"], button, a[onclick*="__doPostBack"]'),
      )

      for (const candidate of candidates) {
        if (!isVisible(candidate) || !canSubmitControl(candidate)) {
          continue
        }

        const postBackTarget = candidate.getAttribute('onclick')?.match(/__doPostBack\('([^']+)'/)?.[1]
        if (postBackTarget && typeof win.__doPostBack === 'function') {
          try {
            win.__doPostBack(postBackTarget, '')
            return true
          } catch {
            // Fall through to a native click attempt.
          }
        }

        if (
          candidate instanceof HTMLInputElement ||
          candidate instanceof HTMLButtonElement ||
          candidate instanceof HTMLAnchorElement
        ) {
          candidate.click()
          return true
        }
      }

      const form = document.querySelector('form') as HTMLFormElement | null
      if (!form) return false

      if (typeof form.requestSubmit === 'function') {
        form.requestSubmit()
        return true
      }

      form.submit()
      return true
    })
    .catch(() => false)

  if (domSubmitted) {
    await settleAfterRedwoodFormAction(page)
    return true
  }

  return false
}

async function detectImportReviewState(args: {
  page: any
  submitSelectors: string[]
}): Promise<{
  hasImportRejection: boolean
  hasImportProcessedSummary: boolean
  reviewState: {
    importTextareaText: string
    summary: string
  }
  submitVisible: boolean
  visibleErrors: string[]
}> {
  const { page, submitSelectors } = args
  const submitVisible = await waitForAnyVisible(page, submitSelectors, 1000)
  const reviewState = await readImportReviewState(page)
  const visibleErrors = await collectVisibleTexts(
    page,
    [
      '.validation-summary-errors',
      '.validation-summary-valid',
      '.error',
      '[class*="error"]',
      '[id*="Error"]',
      '[id*="Validation"]',
      'textarea',
    ],
    6,
  )

  const visibleErrorSummary = visibleErrors.join(' | ').toLowerCase()
  const hasImportProcessedSummary = Boolean(
    reviewState.importTextareaText.trim() && isImportProcessedSummary(reviewState.summary),
  )
  const hasImportRejection = Boolean(
    reviewState.importTextareaText.trim() &&
      (isImportRejectionSummary(reviewState.summary) || isImportRejectionSummary(visibleErrorSummary)),
  )

  return {
    hasImportRejection,
    hasImportProcessedSummary,
    reviewState,
    submitVisible,
    visibleErrors,
  }
}

async function waitForImportOutcome(args: {
  page: any
  submitSelectors: string[]
  timeoutMs: number
}): Promise<void> {
  const { page, submitSelectors, timeoutMs } = args
  const startedAt = Date.now()

  while (Date.now() - startedAt < timeoutMs) {
    if (await waitForAnyVisible(page, submitSelectors, 200)) {
      return
    }

    const reviewState = await readImportReviewState(page)
    if (reviewState.importTextareaText.trim()) {
      return
    }

    await page.waitForTimeout(300)
  }
}

async function routeImportToManualReview(args: {
  payload: Payload
  page: any
  clientId: string
  source: string
  outputDir: string
  importTextareaText: string
  warningMessage: string
}): Promise<{ status: 'manual-review'; screenshotPath: string }> {
  const { payload, page, clientId, source, outputDir, importTextareaText, warningMessage } = args
  const screenshotPath = path.join(outputDir, 'screenshots', `redwood-import-rejected-${clientId}-${Date.now()}.png`)
  await fs.mkdir(path.dirname(screenshotPath), { recursive: true })
  await dismissCookieBanner(page)
  await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => undefined)

  const rejectionDetails = buildImportRejectionDetails(importTextareaText)

  await updateClientRedwoodState(payload, clientId, {
    redwoodSyncStatus: 'manual-review',
    redwoodMatchedBy: null,
    redwoodMatchedDonorName: null,
    redwoodImportScreenshotPath: screenshotPath,
    redwoodLastAttemptAt: new Date().toISOString(),
    redwoodLastError: rejectionDetails || 'Redwood import rejected row(s).',
  })

  await createAdminAlert(payload, {
    severity: 'high',
    alertType: 'data-integrity',
    title: `Redwood import rejected row(s) for client ${clientId}`,
    message: rejectionDetails || 'Redwood rejected one or more import rows. Manual review required.',
    context: {
      clientId,
      source,
      queue: 'redwood',
      screenshotPath,
    },
  })

  payload.logger.warn({
    msg: warningMessage,
    clientId,
    source,
    screenshotPath,
    rejectionDetails,
    queue: 'redwood',
  })

  return {
    status: 'manual-review',
    screenshotPath,
  }
}

async function routeMatchedDonorToManualReview(args: {
  payload: Payload
  clientId: string
  source: string
  donorMatch: {
    matchedBy: RedwoodMatchBy
    donor: RedwoodExportDonor
    score?: number
  }
}): Promise<{ status: 'manual-review'; matchedBy: RedwoodMatchBy }> {
  const { payload, clientId, donorMatch, source } = args

  const matchedDonorName = buildMatchedDonorName(donorMatch)
  const scoreMessage =
    typeof donorMatch.score === 'number' ? ` Similarity score: ${donorMatch.score.toFixed(3)}.` : ''
  const uniqueId = donorMatch.donor.uniqueId?.trim() || null
  const email = donorMatch.donor.email?.trim() || null
  const message = `Potential existing Redwood donor "${matchedDonorName}" matched by ${donorMatch.matchedBy}.${scoreMessage} Manual review required before import.`

  await updateClientRedwoodState(payload, clientId, {
    redwoodSyncStatus: 'manual-review',
    redwoodMatchedBy: donorMatch.matchedBy,
    redwoodMatchedDonorName: matchedDonorName,
    redwoodCallInCode: extractRedwoodCallInCode(donorMatch.donor),
    redwoodLastAttemptAt: new Date().toISOString(),
    redwoodLastError: message,
  })

  await createAdminAlert(payload, {
    severity: 'high',
    alertType: 'data-integrity',
    title: `Potential existing Redwood donor matched for client ${clientId}`,
    message,
    context: {
      clientId,
      source,
      queue: 'redwood',
      matchedBy: donorMatch.matchedBy,
      matchedDonorName,
      matchedDonorUniqueId: uniqueId,
      matchedDonorEmail: email,
      similarityScore: donorMatch.score ?? null,
    },
  })

  payload.logger.warn({
    msg: '[redwood-import] Existing Redwood donor matched before import; routing to manual review',
    clientId,
    source,
    matchedBy: donorMatch.matchedBy,
    matchedDonorName,
    matchedDonorUniqueId: uniqueId,
    matchedDonorEmail: email,
    similarityScore: donorMatch.score ?? null,
    queue: 'redwood',
  })

  return {
    status: 'manual-review',
    matchedBy: donorMatch.matchedBy,
  }
}

async function resolveImportedDonorMetadata(args: {
  accountNumber: string
  client: {
    dob: string
    firstName: string
    lastName: string
    middleInitial?: string | null
  }
  donorSearchUrl: string
  page: any
  uniqueId: string
}): Promise<{
  callInCode: string | null
  donorId: string | null
}> {
  const { accountNumber, client, donorSearchUrl, page, uniqueId } = args
  const donorMatch = await resolveRedwoodDonorMatch({
    accountNumber,
    client: {
      dob: client.dob,
      firstName: client.firstName,
      lastName: client.lastName,
      middleInitial: client.middleInitial || undefined,
      redwoodUniqueId: uniqueId,
    },
    donorSearchUrl,
    page,
  })

  return {
    callInCode: donorMatch.callInCode,
    donorId: donorMatch.donorId,
  }
}

export async function runRedwoodImportClientJob(args: {
  payload: Payload
  clientId: string
  source: string
  playwrightRuntimeProfile?: RedwoodBrowserRuntimeProfile
  playwrightSlowMoMs?: number
}): Promise<{
  status: string
  matchedBy?: RedwoodMatchBy
  screenshotPath?: string
}> {
  const { payload, clientId, source, playwrightRuntimeProfile, playwrightSlowMoMs } = args
  const outputDir = path.resolve(process.cwd(), 'output', 'redwood')
  const accountNumber = getRedwoodAccountNumber()

  const { loginUrl, password, username } = resolveRedwoodAuthEnv()
  const donorSearchUrl = process.env.REDWOOD_DONOR_SEARCH_URL?.trim() || DEFAULT_REDWOOD_DONOR_SEARCH_URL
  const exportUrl = process.env.REDWOOD_EXPORT_URL?.trim() || DEFAULT_REDWOOD_EXPORT_URL
  const importUrl = process.env.REDWOOD_IMPORT_URL?.trim() || DEFAULT_REDWOOD_IMPORT_URL

  assertRedwoodMutationAllowed(accountNumber, 'import')

  const client = await payload.findByID({
    collection: 'clients',
    id: clientId,
    depth: 0,
    overrideAccess: true,
  })

  if (!client?.firstName || !client?.lastName || !client?.dob) {
    throw new Error('Client is missing required fields for Redwood import (firstName, lastName, dob)')
  }

  const clientDob = client.dob
  const uniqueId = (typeof client.redwoodUniqueId === 'string' && client.redwoodUniqueId.trim()) || buildRedwoodUniqueId(client.id)

  await updateClientRedwoodState(payload, client.id, {
    redwoodUniqueId: uniqueId,
    redwoodSyncStatus: 'export-checked',
    redwoodLastAttemptAt: new Date().toISOString(),
    redwoodLastError: null,
  })

  let diagnosticScreenshotPath: string | null = null

  try {
    return await withRedwoodBrowserSession({
      acceptDownloads: true,
      runtimeProfile: playwrightRuntimeProfile ?? 'job',
      slowMoMs: playwrightSlowMoMs,
    }, async ({ page }) => {
      await loginToRedwood(page, { loginUrl, username, password })

      const { csv, csvPath } = await downloadExportCSV({
        page,
        exportUrl,
        outputDir,
      })
      const redwoodServerDate = await extractRedwoodServerDate(page)

      const donors = parseRedwoodExport(csv)
      const donorsForAccount = filterDonorsByAccountNumber(donors, accountNumber)
      const donorMatch = findRedwoodDonorMatch(donorsForAccount, {
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
        donorCount: donorsForAccount.length,
        matchedBy: donorMatch?.matchedBy,
      })

      if (donorMatch) {
        return routeMatchedDonorToManualReview({
          payload,
          clientId: client.id,
          donorMatch,
          source,
        })
      }

      const donorGroup = resolveDonorGroup({
        clientReferralType: client.referralType,
        donors: donorsForAccount,
      })

      const importCsvContent = buildRedwoodImportCSV({
        accountNumber,
        firstName: client.firstName,
        middleInitial: client.middleInitial || '',
        lastName: client.lastName,
        uniqueId,
        dob: clientDob,
        intakeDate: redwoodServerDate || clientDob,
        sex: mapGenderToRedwoodSex(client.gender),
        phoneNumber: normalizePhoneForRedwood(client.phone || ''),
        group: donorGroup,
      })

      const importCsvPath = path.join(outputDir, 'imports', `redwood-import-${client.id}-${Date.now()}.csv`)
      await fs.mkdir(path.dirname(importCsvPath), { recursive: true })
      await fs.writeFile(importCsvPath, importCsvContent, 'utf8')

      await page.goto(importUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })
      await dismissCookieBanner(page)

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

      let submitVisible = await waitForAnyVisible(page, submitSelectors, 5000)
      const previewOnly = isRedwoodImportPreviewOnly()

      if (previewOnly) {
        const screenshotPath = path.join(
          outputDir,
          'screenshots',
          `redwood-import-ready-${client.id}-${Date.now()}.png`,
        )
        await fs.mkdir(path.dirname(screenshotPath), { recursive: true })
        await dismissCookieBanner(page)
        await page.screenshot({ path: screenshotPath, fullPage: true })

        await updateClientRedwoodState(payload, client.id, {
          redwoodSyncStatus: 'ready-to-submit',
          redwoodMatchedBy: null,
          redwoodMatchedDonorName: null,
          redwoodCallInCode: null,
          redwoodImportScreenshotPath: screenshotPath,
          redwoodLastAttemptAt: new Date().toISOString(),
          redwoodLastError: null,
        })

        payload.logger.info({
          msg: '[redwood-import] Preview-only mode: staged import and stopped before upload',
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

      let uploadClicked = false
      if (!submitVisible) {
        uploadClicked = await triggerRedwoodImportUpload({
          fileInput,
          page,
          submitSelectors,
        })
      }

      if (!submitVisible && uploadClicked) {
        const uploadStageScreenshotPath = path.join(
          outputDir,
          'screenshots',
          `redwood-import-uploaded-${client.id}-${Date.now()}.png`,
        )
        await fs.mkdir(path.dirname(uploadStageScreenshotPath), { recursive: true })
        await page.screenshot({ path: uploadStageScreenshotPath, fullPage: true }).catch(() => undefined)

        await waitForImportOutcome({
          page,
          submitSelectors,
          timeoutMs: 45000,
        })
        submitVisible = await waitForAnyVisible(page, submitSelectors, 1000)
      }

      payload.logger.info({
        msg: '[redwood-import] Upload stage evaluated',
        clientId,
        source,
        currentUrl: page.url(),
        previewOnly: isRedwoodImportPreviewOnly(),
        queue: 'redwood',
        submitVisible,
        uploadClicked,
      })

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
        const reviewAssessment = await detectImportReviewState({
          page,
          submitSelectors,
        })

        if (reviewAssessment.hasImportRejection) {
          const manualReview = await routeImportToManualReview({
            payload,
            page,
            clientId: client.id,
            source,
            outputDir,
            importTextareaText: reviewAssessment.reviewState.importTextareaText,
            warningMessage: '[redwood-import] Import rejected rows; routing to manual review',
          })
          diagnosticScreenshotPath = manualReview.screenshotPath
          return manualReview
        }

        if (reviewAssessment.hasImportProcessedSummary) {
          const screenshotPath = path.join(
            outputDir,
            'screenshots',
            `redwood-import-processed-${client.id}-${Date.now()}.png`,
          )
          await fs.mkdir(path.dirname(screenshotPath), { recursive: true })
          await page.screenshot({ path: screenshotPath, fullPage: true })

          let redwoodCallInCode: string | null = null
          let redwoodDonorId: string | null = null

          try {
            const donorMetadata = await resolveImportedDonorMetadata({
              accountNumber,
              client: {
                dob: clientDob,
                firstName: client.firstName,
                lastName: client.lastName,
                middleInitial: client.middleInitial || null,
              },
              donorSearchUrl,
              page,
              uniqueId,
            })
            redwoodCallInCode = donorMetadata.callInCode
            redwoodDonorId = donorMetadata.donorId
          } catch (error) {
            payload.logger.warn({
              msg: '[redwood-import] Redwood donor imported, but donor metadata lookup failed',
              clientId,
              source,
              error: error instanceof Error ? error.message : String(error),
              queue: 'redwood',
            })
          }

          await updateClientRedwoodState(payload, client.id, {
            redwoodSyncStatus: 'synced',
            redwoodMatchedBy: null,
            redwoodMatchedDonorName: null,
            redwoodCallInCode,
            redwoodDonorId,
            redwoodImportScreenshotPath: screenshotPath,
            redwoodLastAttemptAt: new Date().toISOString(),
            redwoodLastError: null,
          })

          payload.logger.info({
            msg: '[redwood-import] Redwood import completed during upload processing',
            clientId,
            source,
            importCsvPath,
            screenshotPath,
            queue: 'redwood',
          })

          const defaultTestResult = await runRedwoodDefaultTestSync(payload, client.id)
          if (!defaultTestResult.success) {
            payload.logger.error({
              msg: '[redwood-import] Redwood donor import succeeded, but default-test sync failed',
              clientId,
              source,
              error: defaultTestResult.error,
            })
          }

          return {
            status: 'synced',
            screenshotPath,
          }
        }

        diagnosticScreenshotPath = path.join(
          outputDir,
          'screenshots',
          `redwood-import-submit-missing-${client.id}-${Date.now()}.png`,
        )
        await fs.mkdir(path.dirname(diagnosticScreenshotPath), { recursive: true })
        await page.screenshot({ path: diagnosticScreenshotPath, fullPage: true }).catch(() => undefined)

        const details = [
          `currentUrl=${page.url()}`,
          `visibleErrors=${reviewAssessment.visibleErrors.length > 0 ? reviewAssessment.visibleErrors.join(' | ') : 'none'}`,
          `screenshotPath=${diagnosticScreenshotPath}`,
        ].join(' ')

        throw new Error(`Redwood import did not reach submit-ready state. ${details}`)
      }

      const screenshotPath = path.join(
        outputDir,
        'screenshots',
        `redwood-import-submitted-${client.id}-${Date.now()}.png`,
      )
      await fs.mkdir(path.dirname(screenshotPath), { recursive: true })
      await dismissCookieBanner(page)

      const submitClicked = await triggerRedwoodImportSubmit({
        page,
        submitSelectors,
      })
      payload.logger.info({
        msg: '[redwood-import] Final submit attempted',
        clientId,
        source,
        currentUrl: page.url(),
        queue: 'redwood',
        submitClicked,
      })
      if (!submitClicked) {
        throw new Error('Unable to click Redwood import submit control')
      }

      const reviewAssessment = await detectImportReviewState({
        page,
        submitSelectors,
      })

      if (reviewAssessment.hasImportRejection) {
        const manualReview = await routeImportToManualReview({
          payload,
          page,
          clientId: client.id,
          source,
          outputDir,
          importTextareaText: reviewAssessment.reviewState.importTextareaText,
          warningMessage: '[redwood-import] Import rejected rows after final submit; routing to manual review',
        })
        diagnosticScreenshotPath = manualReview.screenshotPath
        return manualReview
      }

      const submitStillVisible = reviewAssessment.submitVisible
      const successIndicators = [
        'successfully imported',
        'import complete',
        'import completed',
        'records processed',
        'processed successfully',
        'donor imported',
      ]
      const hasSuccessIndicator = successIndicators.some((indicator) =>
        reviewAssessment.reviewState.summary.includes(indicator),
      )

      if (submitStillVisible && !hasSuccessIndicator) {
        diagnosticScreenshotPath = path.join(
          outputDir,
          'screenshots',
          `redwood-import-submit-stalled-${client.id}-${Date.now()}.png`,
        )
        await fs.mkdir(path.dirname(diagnosticScreenshotPath), { recursive: true })
        await page.screenshot({ path: diagnosticScreenshotPath, fullPage: true }).catch(() => undefined)

        throw new Error(
          `Redwood import submit action did not complete. currentUrl=${page.url()} screenshotPath=${diagnosticScreenshotPath}`,
        )
      }

      await page.screenshot({ path: screenshotPath, fullPage: true })

      let redwoodCallInCode: string | null = null
      let redwoodDonorId: string | null = null

      try {
        const donorMetadata = await resolveImportedDonorMetadata({
          accountNumber,
          client: {
            dob: clientDob,
            firstName: client.firstName,
            lastName: client.lastName,
            middleInitial: client.middleInitial || null,
          },
          donorSearchUrl,
          page,
          uniqueId,
        })
        redwoodCallInCode = donorMetadata.callInCode
        redwoodDonorId = donorMetadata.donorId
      } catch (error) {
        payload.logger.warn({
          msg: '[redwood-import] Redwood donor submitted, but donor metadata lookup failed',
          clientId,
          source,
          error: error instanceof Error ? error.message : String(error),
          queue: 'redwood',
        })
      }

      await updateClientRedwoodState(payload, client.id, {
        redwoodSyncStatus: 'synced',
        redwoodMatchedBy: null,
        redwoodMatchedDonorName: null,
        redwoodCallInCode,
        redwoodDonorId,
        redwoodImportScreenshotPath: screenshotPath,
        redwoodLastAttemptAt: new Date().toISOString(),
        redwoodLastError: null,
      })

      payload.logger.info({
        msg: '[redwood-import] Submitted Redwood import successfully',
        clientId,
        source,
        importCsvPath,
        screenshotPath,
        queue: 'redwood',
      })

      const defaultTestResult = await runRedwoodDefaultTestSync(payload, client.id)
      if (!defaultTestResult.success) {
        payload.logger.error({
          msg: '[redwood-import] Redwood donor import succeeded, but default-test sync failed',
          clientId,
          source,
          error: defaultTestResult.error,
        })
      }

      return {
        status: 'synced',
        screenshotPath,
      }
    })
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
  }
}
