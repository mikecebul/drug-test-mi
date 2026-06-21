import fs from 'node:fs/promises'
import path from 'node:path'

import { calculateNameSimilarity } from '@/views/DrugTestWizard/utils/calculateSimilarity'
import {
  buildRedwoodDonorSearchResultsUrl,
  buildRedwoodDonorViewUrl,
  extractRedwoodDonorIdFromUrl,
} from '@/lib/redwood/donor-urls'
import { clickFirstVisible, dismissCookieBanner } from '@/lib/redwood/playwright'

const DONOR_AMBIGUOUS_SCORE_DELTA = 0.02
const NAME_ONLY_MIN_SCORE = 0.85

export const VIEW_CONTROL_SELECTOR = [
  'button:has-text("VIEW")',
  'button:has-text("View")',
  'a:has-text("VIEW")',
  'a:has-text("View")',
  'input[type="submit"][value*="VIEW"]',
  'input[type="submit"][value*="View"]',
  'input[type="button"][value*="VIEW"]',
  'input[type="button"][value*="View"]',
].join(', ')

export type RedwoodDonorLookupClient = {
  firstName: string
  lastName: string
  middleInitial?: string | null
  dob?: string | null
  redwoodUniqueId?: string
  redwoodDonorId?: string
}

export type RedwoodDonorTableRow = {
  cells: string[]
  rowIndex: number
}

export type RedwoodDonorCandidate = {
  cells: string[]
  displayName: string
  dobKey?: string
  firstName: string
  lastName: string
  middleInitial?: string
  rowIndex: number
  score: number
  uniqueId?: string
}

export type RedwoodResolvedDonorMatch = {
  callInCode: string | null
  donorId: string | null
  matchedDonorName: string
}

export function normalizeRedwoodNameValue(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z\s,'-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function parseRedwoodDateKey(value?: string | null): string | null {
  if (!value) return null

  const trimmed = value.trim()
  if (!trimmed) return null

  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    return trimmed.slice(0, 10)
  }

  const normalized = trimmed.replace(/,\s*/g, ' ').replace(/(\d)(AM|PM)/gi, '$1 $2').replace(/\s+/g, ' ').trim()
  const parsed = new Date(normalized)
  if (Number.isNaN(parsed.getTime())) return null

  const year = parsed.getFullYear()
  const month = String(parsed.getMonth() + 1).padStart(2, '0')
  const day = String(parsed.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function parseRedwoodDonorName(rawName: string):
  | {
      firstName: string
      lastName: string
      middleInitial?: string
    }
  | null {
  const cleaned = normalizeRedwoodNameValue(rawName)
  if (!cleaned) return null

  if (cleaned.includes(',')) {
    const [lastRaw, firstRaw] = cleaned.split(',', 2)
    const firstParts = normalizeRedwoodNameValue(firstRaw || '').split(' ').filter(Boolean)
    if (!lastRaw || firstParts.length === 0) return null

    return {
      firstName: firstParts[0],
      lastName: normalizeRedwoodNameValue(lastRaw),
      middleInitial: firstParts[1]?.charAt(0),
    }
  }

  const parts = cleaned.split(' ').filter(Boolean)
  if (parts.length < 2) return null

  return {
    firstName: parts[0],
    lastName: parts[parts.length - 1],
    middleInitial: parts.length > 2 ? parts[1].charAt(0) : undefined,
  }
}

export function getRedwoodAccountCell(cells: string[]): string | undefined {
  for (const cell of cells) {
    const trimmed = cell.trim()
    if (!trimmed) continue

    if (/^\d{6}$/.test(trimmed)) {
      return trimmed
    }

    const embeddedAccountMatch = trimmed.match(/\((\d{6})\)/)
    if (embeddedAccountMatch?.[1]) {
      return embeddedAccountMatch[1]
    }
  }

  return undefined
}

export function getRedwoodDobCell(cells: string[]): string | undefined {
  return cells.find((cell) => {
    const value = cell.trim()
    if (!value) return false

    const hasYear = /\b(19|20)\d{2}\b/.test(value)
    const hasDatePattern = /\d{1,2}\/\d{1,2}\/\d{2,4}/.test(value) || /[a-zA-Z]{3,}\s+\d{1,2}/.test(value)
    return hasYear && hasDatePattern
  })
}

export function getRedwoodUniqueIdCell(cells: string[]): string | undefined {
  return cells.find((cell) => {
    const trimmed = cell.trim()
    return /^[A-Z0-9]{6,20}$/i.test(trimmed) && !/^\d{6}$/.test(trimmed)
  })
}

export function buildRedwoodDonorCandidates(
  rows: RedwoodDonorTableRow[],
  accountNumber: string,
  client: Pick<RedwoodDonorLookupClient, 'dob' | 'firstName' | 'lastName' | 'middleInitial'>,
): RedwoodDonorCandidate[] {
  return rows.flatMap((row) => {
    const matchedAccount = getRedwoodAccountCell(row.cells)
    if (matchedAccount !== accountNumber) return []

    const nameCell = row.cells.find((cell) => cell.includes(',')) || row.cells[1] || row.cells[0]
    const parsedName = parseRedwoodDonorName(nameCell)
    if (!parsedName) return []

    const score = calculateNameSimilarity(
      client.firstName,
      client.lastName,
      parsedName.firstName,
      parsedName.lastName,
      client.middleInitial || undefined,
      parsedName.middleInitial,
    )

    return [
      {
        cells: row.cells,
        displayName: `${parsedName.lastName}, ${parsedName.firstName}`,
        dobKey: parseRedwoodDateKey(getRedwoodDobCell(row.cells)) || undefined,
        firstName: parsedName.firstName,
        lastName: parsedName.lastName,
        middleInitial: parsedName.middleInitial,
        rowIndex: row.rowIndex,
        score,
        uniqueId: getRedwoodUniqueIdCell(row.cells),
      },
    ]
  })
}

export function findExactRedwoodUniqueIdCandidate(
  candidates: RedwoodDonorCandidate[],
  uniqueId?: string | null,
): RedwoodDonorCandidate | null {
  const normalizedUniqueId = uniqueId?.trim().toUpperCase()
  if (!normalizedUniqueId) return null

  return (
    candidates.find((candidate) => candidate.uniqueId?.trim().toUpperCase() === normalizedUniqueId) || null
  )
}

export function selectBestRedwoodDonorCandidate(
  candidates: RedwoodDonorCandidate[],
  clientDob?: string | null,
): RedwoodDonorCandidate {
  if (candidates.length === 0) {
    throw new Error('No donor rows matched the allowed Redwood account')
  }

  const clientDobKey = parseRedwoodDateKey(clientDob)

  if (clientDobKey) {
    const dobMatches = candidates.filter((candidate) => candidate.dobKey === clientDobKey).sort((a, b) => b.score - a.score)

    if (dobMatches.length === 0) {
      throw new Error('No DOB-verified Redwood donor match found in the allowed account')
    }

    const top = dobMatches[0]
    const runnerUp = dobMatches[1]
    if (runnerUp && top.score - runnerUp.score <= DONOR_AMBIGUOUS_SCORE_DELTA) {
      throw new Error('Multiple DOB-verified Redwood donor matches are ambiguous in the allowed account')
    }

    return top
  }

  const sorted = [...candidates].sort((a, b) => b.score - a.score)
  const top = sorted[0]
  if (top.score < NAME_ONLY_MIN_SCORE) {
    throw new Error('No confident name-only Redwood donor match found in the allowed account')
  }

  const runnerUp = sorted[1]
  if (runnerUp && top.score - runnerUp.score <= DONOR_AMBIGUOUS_SCORE_DELTA) {
    throw new Error('Multiple name-only Redwood donor matches are ambiguous in the allowed account')
  }

  return top
}

export function resolveBestRedwoodDonorCandidate(
  candidates: RedwoodDonorCandidate[],
  client: Pick<RedwoodDonorLookupClient, 'dob' | 'redwoodUniqueId'>,
): RedwoodDonorCandidate {
  return findExactRedwoodUniqueIdCandidate(candidates, client.redwoodUniqueId) || selectBestRedwoodDonorCandidate(candidates, client.dob)
}

async function waitForRedwoodResultsNavigation(page: any): Promise<boolean> {
  await page.waitForLoadState('domcontentloaded', { timeout: 8000 }).catch(() => {})
  await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {})
  await page.waitForTimeout(800)
  return !/DonorSearch\.aspx/i.test(page.url())
}

async function submitWithAspNetPostBack(page: any, targets: string[]): Promise<boolean> {
  return await page.evaluate((eventTargets: string[]) => {
    const win = window as unknown as { __doPostBack?: (eventTarget: string, eventArgument: string) => void }
    if (typeof win.__doPostBack !== 'function') return false

    for (const target of eventTargets) {
      try {
        win.__doPostBack(target, '')
        return true
      } catch {
        // Try next target.
      }
    }

    return false
  }, targets)
}

export async function submitRedwoodDonorSearch(page: any): Promise<boolean> {
  const clicked = await clickFirstVisible(page, [
    '#PageContent_DonorSearchParameterForm1_Search',
    'input[name="ctl00$PageContent$DonorSearchParameterForm1$Search"]',
    'input[id*="DonorSearchParameterForm1_Search"]',
    'button:has-text("Search")',
    'input[type="submit"][value*="Search"]',
  ])

  if (clicked && (await waitForRedwoodResultsNavigation(page))) {
    return true
  }

  const nativeClicked = await page
    .evaluate(() => {
      const button = document.getElementById('PageContent_DonorSearchParameterForm1_Search') as HTMLInputElement | null
      if (!button) return false
      button.click()
      return true
    })
    .catch(() => false)

  if (nativeClicked && (await waitForRedwoodResultsNavigation(page))) {
    return true
  }

  const postbackSubmitted = await submitWithAspNetPostBack(page, [
    'ctl00$PageContent$DonorSearchParameterForm1$Search',
    'ctl00$PageContent$DonorSearchParameterForm1$btnSearch',
  ])

  if (postbackSubmitted && (await waitForRedwoodResultsNavigation(page))) {
    return true
  }

  const formSubmitted = await page.evaluate(() => {
    const input = document.querySelector('#PageContent_DonorSearchParameterForm1_txtLastName') as HTMLInputElement | null
    const form = input?.form || (document.querySelector('form') as HTMLFormElement | null)
    if (!form) return false
    if (typeof form.requestSubmit === 'function') {
      form.requestSubmit()
      return true
    }
    form.submit()
    return true
  })

  return formSubmitted && (await waitForRedwoodResultsNavigation(page))
}

async function waitForRedwoodPageReady(page: any): Promise<void> {
  await page.waitForLoadState('domcontentloaded', { timeout: 20000 })
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {})
  await page.waitForTimeout(800)
}

export async function openRedwoodSearchResultsForLastName(args: {
  accountNumber?: string
  donorSearchUrl: string
  lastName: string
  page: any
}): Promise<void> {
  const { accountNumber, donorSearchUrl, lastName, page } = args
  const searchResultsUrl = buildRedwoodDonorSearchResultsUrl({
    donorSearchUrl,
    lastName: normalizeRedwoodNameValue(lastName),
    accountNumber,
    active: true,
  })

  await page.goto(searchResultsUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await waitForRedwoodPageReady(page)
}

export async function openRedwoodSearchResultsForUniqueId(args: {
  accountNumber?: string
  donorSearchUrl: string
  page: any
  uniqueId: string
}): Promise<void> {
  const { accountNumber, donorSearchUrl, page, uniqueId } = args
  const searchResultsUrl = buildRedwoodDonorSearchResultsUrl({
    donorSearchUrl,
    uniqueId,
    accountNumber,
    active: true,
  })

  await page.goto(searchResultsUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await waitForRedwoodPageReady(page)
}

export async function readRedwoodDonorResultRows(
  page: any,
  emptyResultsMessage = 'No Redwood donor rows found on donor search results',
): Promise<{
  rows: any
  tableRows: RedwoodDonorTableRow[]
}> {
  const rows = page.locator('tr').filter({
    has: page.locator(VIEW_CONTROL_SELECTOR),
  })
  const rowCount = await rows.count()

  if (rowCount === 0) {
    throw new Error(emptyResultsMessage)
  }

  const tableRows: RedwoodDonorTableRow[] = []
  for (let index = 0; index < rowCount; index++) {
    const row = rows.nth(index)
    const cells = (await row.locator('td').allTextContents()).map((cell) => cell.trim()).filter(Boolean)
    if (cells.length === 0) continue
    tableRows.push({ cells, rowIndex: index })
  }

  return { rows, tableRows }
}

export async function openRedwoodCandidateDetail(page: any, rows: any, rowIndex: number): Promise<string | null> {
  const selectedRow = rows.nth(rowIndex)
  const viewButton = selectedRow.locator(VIEW_CONTROL_SELECTOR).first()
  const viewHref = (await viewButton.getAttribute('href')) || ''
  const postBackMatch = viewHref.match(/__doPostBack\('([^']+)'/)
  const beforeViewUrl = page.url()

  await viewButton.click()
  await page.waitForLoadState('domcontentloaded', { timeout: 20000 })
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {})
  await page.waitForTimeout(600)

  const stillOnResultsPage = /DonorSearchResults\.aspx/i.test(page.url()) || page.url() === beforeViewUrl
  if (stillOnResultsPage && postBackMatch?.[1]) {
    await page.evaluate((target) => {
      const win = window as unknown as { __doPostBack?: (eventTarget: string, eventArgument: string) => void }
      if (typeof win.__doPostBack === 'function') {
        win.__doPostBack(target, '')
      }
    }, postBackMatch[1])

    await page.waitForLoadState('domcontentloaded', { timeout: 20000 })
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {})
    await page.waitForTimeout(600)
  }

  return extractRedwoodDonorIdFromUrl(page.url())
}

export async function readRedwoodDonorMetadata(page: any): Promise<{
  callInCode: string | null
  donorId: string | null
}> {
  return await page.evaluate(() => {
    const donorId = (() => {
      try {
        return new URL(window.location.href).searchParams.get('donorid')?.trim() || null
      } catch {
        return null
      }
    })()

    const bodyLines = (document.body?.innerText || '')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)

    let callInCode: string | null = null
    for (let index = 0; index < bodyLines.length; index++) {
      const line = bodyLines[index]
      if (!/check-?in code\/pin:/i.test(line)) continue

      const inline = line.split(':')[1]?.trim()
      if (inline) {
        callInCode = inline
        break
      }

      const nextLine = bodyLines[index + 1]?.trim()
      if (nextLine) {
        callInCode = nextLine
        break
      }
    }

    return {
      callInCode,
      donorId,
    }
  })
}

export async function readRedwoodDonorEditPhotoState(page: any): Promise<{
  canRemovePhoto: boolean
  photoFlagValue: string | null
}> {
  return await page.evaluate(() => {
    const removeButton = document.getElementById('PageContent_Donor_RemovePhoto') as HTMLInputElement | null
    const photoFlag = document.getElementById('PageContent_Donor_IsDonorPhotExist') as HTMLInputElement | null
    const canRemovePhoto = Boolean(
      removeButton &&
        (removeButton.offsetWidth || removeButton.offsetHeight || removeButton.getClientRects().length),
    )

    return {
      canRemovePhoto,
      photoFlagValue: photoFlag?.value?.trim() || null,
    }
  })
}

export async function captureRedwoodDiagnostic(page: any, prefix: string): Promise<string> {
  const outputPath = path.join(process.cwd(), 'output', 'redwood', 'screenshots', `${prefix}-${Date.now()}.png`)
  await fs.mkdir(path.dirname(outputPath), { recursive: true })
  await dismissCookieBanner(page)
  await page.screenshot({ path: outputPath, fullPage: true }).catch(() => undefined)
  return outputPath
}

export async function resolveRedwoodDonorMatch(args: {
  accountNumber: string
  client: RedwoodDonorLookupClient
  donorSearchUrl: string
  page: any
}): Promise<RedwoodResolvedDonorMatch> {
  const { accountNumber, client, donorSearchUrl, page } = args

  if (client.redwoodDonorId?.trim()) {
    await page.goto(buildRedwoodDonorViewUrl(donorSearchUrl, client.redwoodDonorId.trim()), {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    })
    await waitForRedwoodPageReady(page)

    const donorMetadata = await readRedwoodDonorMetadata(page)
    return {
      callInCode: donorMetadata.callInCode,
      donorId: donorMetadata.donorId || client.redwoodDonorId.trim(),
      matchedDonorName: `${client.lastName}, ${client.firstName}`,
    }
  }

  if (client.redwoodUniqueId?.trim()) {
    await openRedwoodSearchResultsForUniqueId({
      accountNumber,
      donorSearchUrl,
      page,
      uniqueId: client.redwoodUniqueId.trim(),
    })

    const { rows, tableRows } = await readRedwoodDonorResultRows(
      page,
      `No Redwood donor rows found for unique ID "${client.redwoodUniqueId.trim()}"`,
    )
    const candidates = buildRedwoodDonorCandidates(tableRows, accountNumber, client)
    const exactCandidate = findExactRedwoodUniqueIdCandidate(candidates, client.redwoodUniqueId)

    if (exactCandidate) {
      const donorId = await openRedwoodCandidateDetail(page, rows, exactCandidate.rowIndex)
      const donorMetadata = await readRedwoodDonorMetadata(page)

      return {
        callInCode: donorMetadata.callInCode,
        donorId: donorMetadata.donorId || donorId,
        matchedDonorName: exactCandidate.displayName,
      }
    }
  }

  await openRedwoodSearchResultsForLastName({
    accountNumber,
    donorSearchUrl,
    lastName: client.lastName,
    page,
  })

  const { rows, tableRows } = await readRedwoodDonorResultRows(
    page,
    `No Redwood donor rows found for last name "${client.lastName}"`,
  )
  const candidates = buildRedwoodDonorCandidates(tableRows, accountNumber, client)
  const selectedCandidate = selectBestRedwoodDonorCandidate(candidates, client.dob)
  const donorId = await openRedwoodCandidateDetail(page, rows, selectedCandidate.rowIndex)
  const donorMetadata = await readRedwoodDonorMetadata(page)

  return {
    callInCode: donorMetadata.callInCode,
    donorId: donorMetadata.donorId || donorId,
    matchedDonorName: selectedCandidate.displayName,
  }
}
