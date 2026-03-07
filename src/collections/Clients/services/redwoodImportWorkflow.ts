import fs from 'node:fs/promises'
import path from 'node:path'

import type { Payload } from 'payload'

import { createAdminAlert } from '@/lib/admin-alerts'
import { assertRedwoodMutationAllowed, getRedwoodAccountNumber } from '@/lib/redwood/config'
import {
  buildRedwoodImportCSV,
  extractRedwoodCallInCode,
  findRedwoodDonorMatch,
  parseRedwoodExport,
  type RedwoodMatchBy,
} from '@/lib/redwood/csv'
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
import { buildRedwoodUniqueId } from '@/lib/redwood/unique-id'
import { runRedwoodDefaultTestSync } from './redwoodDefaultTestSync'

const DEFAULT_REDWOOD_EXPORT_URL = 'https://toxaccess.redwoodtoxicology.com/Pages/User/ExportDonors.aspx'
const DEFAULT_REDWOOD_IMPORT_URL = 'https://toxaccess.redwoodtoxicology.com/Pages/User/ImportDonors.aspx'

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
  return (
    summary.includes('rejected record') ||
    summary.includes('donor(s) rejected') ||
    summary.includes('reason 1') ||
    summary.includes('invalid ')
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
        await updateClientRedwoodState(payload, client.id, {
          redwoodSyncStatus: 'matched-existing',
          redwoodMatchedBy: donorMatch.matchedBy,
          redwoodMatchedDonorName: buildMatchedDonorName(donorMatch),
          redwoodCallInCode: extractRedwoodCallInCode(donorMatch.donor),
          redwoodLastAttemptAt: new Date().toISOString(),
          redwoodLastError: null,
        })

        const defaultTestResult = await runRedwoodDefaultTestSync(payload, client.id)
        if (!defaultTestResult.success) {
          payload.logger.error({
            msg: '[redwood-import] Redwood donor matched, but default-test sync failed',
            clientId,
            source,
            error: defaultTestResult.error,
          })
        }

        return {
          status: 'matched-existing',
          matchedBy: donorMatch.matchedBy,
        }
      }

      const donorGroup = resolveDonorGroup(donorsForAccount)

      const importCsvContent = buildRedwoodImportCSV({
        accountNumber,
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
        const uploadStageScreenshotPath = path.join(
          outputDir,
          'screenshots',
          `redwood-import-uploaded-${client.id}-${Date.now()}.png`,
        )
        await fs.mkdir(path.dirname(uploadStageScreenshotPath), { recursive: true })
        await page.screenshot({ path: uploadStageScreenshotPath, fullPage: true }).catch(() => undefined)

        submitVisible = await waitForAnyVisible(page, submitSelectors, 45000)
      }

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
        const reviewState = await readImportReviewState(page)
        const hasImportRejection = isImportRejectionSummary(reviewState.summary)

        if (hasImportRejection) {
          const manualReview = await routeImportToManualReview({
            payload,
            page,
            clientId: client.id,
            source,
            outputDir,
            importTextareaText: reviewState.importTextareaText,
            warningMessage: '[redwood-import] Import rejected rows; routing to manual review',
          })
          diagnosticScreenshotPath = manualReview.screenshotPath
          return manualReview
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

      const previewOnly = isRedwoodImportPreviewOnly()
      const screenshotPath = path.join(
        outputDir,
        'screenshots',
        `${previewOnly ? 'redwood-import-ready' : 'redwood-import-submitted'}-${client.id}-${Date.now()}.png`,
      )
      await fs.mkdir(path.dirname(screenshotPath), { recursive: true })
      await dismissCookieBanner(page)

      if (!previewOnly) {
        const submitClicked = await clickFirstVisible(page, submitSelectors)
        if (!submitClicked) {
          throw new Error('Unable to click Redwood import submit control')
        }

        await page.waitForLoadState('domcontentloaded', { timeout: 30000 }).catch(() => undefined)
        await page.waitForTimeout(1500)
        await dismissCookieBanner(page)

        const reviewState = await readImportReviewState(page)
        const hasImportRejection = isImportRejectionSummary(reviewState.summary)

        if (hasImportRejection) {
          const manualReview = await routeImportToManualReview({
            payload,
            page,
            clientId: client.id,
            source,
            outputDir,
            importTextareaText: reviewState.importTextareaText,
            warningMessage: '[redwood-import] Import rejected rows after final submit; routing to manual review',
          })
          diagnosticScreenshotPath = manualReview.screenshotPath
          return manualReview
        }

        const submitStillVisible = await waitForAnyVisible(page, submitSelectors, 1500)
        const successIndicators = [
          'successfully imported',
          'import complete',
          'import completed',
          'records processed',
          'processed successfully',
          'donor imported',
        ]
        const hasSuccessIndicator = successIndicators.some((indicator) => reviewState.summary.includes(indicator))

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
      }

      await page.screenshot({ path: screenshotPath, fullPage: true })

      let redwoodCallInCode: string | null = null
      if (!previewOnly) {
        const refreshedExport = await downloadExportCSV({
          page,
          exportUrl,
          outputDir,
        })
        const refreshedDonors = filterDonorsByAccountNumber(parseRedwoodExport(refreshedExport.csv), accountNumber)
        const refreshedMatch = findRedwoodDonorMatch(refreshedDonors, {
          uniqueId,
          firstName: client.firstName,
          middleInitial: client.middleInitial || null,
          lastName: client.lastName,
          dob: client.dob,
        })
        redwoodCallInCode = extractRedwoodCallInCode(refreshedMatch?.donor)
      }

      await updateClientRedwoodState(payload, client.id, {
        redwoodSyncStatus: previewOnly ? 'ready-to-submit' : 'synced',
        redwoodMatchedBy: null,
        redwoodMatchedDonorName: null,
        redwoodCallInCode,
        redwoodImportScreenshotPath: screenshotPath,
        redwoodLastAttemptAt: new Date().toISOString(),
        redwoodLastError: null,
      })

      payload.logger.info({
        msg: previewOnly
          ? '[redwood-import] Preview-only mode: staged import and stopped before final submit'
          : '[redwood-import] Submitted Redwood import successfully',
        clientId,
        source,
        importCsvPath,
        screenshotPath,
        queue: 'redwood',
      })

      if (!previewOnly) {
        const defaultTestResult = await runRedwoodDefaultTestSync(payload, client.id)
        if (!defaultTestResult.success) {
          payload.logger.error({
            msg: '[redwood-import] Redwood donor import succeeded, but default-test sync failed',
            clientId,
            source,
            error: defaultTestResult.error,
          })
        }
      }

      return {
        status: previewOnly ? 'ready-to-submit' : 'synced',
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
