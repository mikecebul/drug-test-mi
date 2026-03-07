import { promises as fs } from 'fs'
import path from 'path'
import type { Payload } from 'payload'
import sharp from 'sharp'

import { calculateNameSimilarity } from '@/views/DrugTestWizard/utils/calculateSimilarity'
import { fetchDocument, type FetchDocumentResult } from '@/collections/DrugTests/services/documentFetch'
import {
  buildRedwoodDonorEditUrl,
  buildRedwoodDonorSearchResultsUrl,
  buildRedwoodDonorViewUrl,
  extractRedwoodDonorIdFromUrl,
} from '@/lib/redwood/donor-urls'
import {
  clickFirstVisible,
  dismissCookieBanner,
  fillFirstVisibleInput,
  loginToRedwood,
  openRedwoodBrowserContext,
  resolveRedwoodAuthEnv,
  waitForAnyVisible,
} from '@/lib/redwood/playwright'

const DEFAULT_REDWOOD_DONOR_SEARCH_URL = 'https://toxaccess.redwoodtoxicology.com/Pages/User/DonorSearch.aspx'
const DONOR_AMBIGUOUS_SCORE_DELTA = 0.02
const NAME_ONLY_MIN_SCORE = 0.85

const VIEW_CONTROL_SELECTOR = [
  'button:has-text("VIEW")',
  'button:has-text("View")',
  'a:has-text("VIEW")',
  'a:has-text("View")',
  'input[type="submit"][value*="VIEW"]',
  'input[type="submit"][value*="View"]',
  'input[type="button"][value*="VIEW"]',
  'input[type="button"][value*="View"]',
].join(', ')

type RedwoodCandidate = {
  rowIndex: number
  cells: string[]
  firstName: string
  lastName: string
  middleInitial?: string
  uniqueId?: string
  dobKey?: string
  score: number
}

type RedwoodDonorLookupClient = {
  firstName: string
  lastName: string
  middleInitial?: string | null
  dob?: string | null
  redwoodUniqueId?: string
  redwoodDonorId?: string
}

function normalizeNameValue(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z\s'-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function parseDateKey(value?: string | null): string | null {
  if (!value) return null

  const trimmed = value.trim()
  if (!trimmed) return null

  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    return trimmed.slice(0, 10)
  }

  const normalized = trimmed.replace(/,\s*/g, ' ').replace(/\s+/g, ' ').trim()
  const parsed = new Date(normalized)
  if (Number.isNaN(parsed.getTime())) return null

  const year = parsed.getFullYear()
  const month = String(parsed.getMonth() + 1).padStart(2, '0')
  const day = String(parsed.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function parseDonorName(rawName: string): {
  firstName: string
  lastName: string
  middleInitial?: string
} | null {
  const cleaned = normalizeNameValue(rawName)
  if (!cleaned) return null

  if (cleaned.includes(',')) {
    const [lastRaw, firstRaw] = cleaned.split(',', 2)
    const firstParts = normalizeNameValue(firstRaw || '').split(' ').filter(Boolean)
    if (!lastRaw || firstParts.length === 0) return null

    return {
      firstName: firstParts[0],
      lastName: normalizeNameValue(lastRaw),
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

function getCellByMatch(cells: string[], pattern: RegExp): string | undefined {
  return cells.find((cell) => pattern.test(cell.trim()))
}

function getAccountCell(cells: string[]): string | undefined {
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

function getDobCell(cells: string[]): string | undefined {
  return cells.find((cell) => {
    const value = cell.trim()
    return /\b(19|20)\d{2}\b/.test(value) && /\d{1,2}\/\d{1,2}\/\d{2,4}/.test(value)
  })
}

function getUniqueIdCell(cells: string[]): string | undefined {
  return cells.find((cell) => /^[A-Z0-9]{6,20}$/i.test(cell.trim()))
}

function buildUploadFileName(clientId: string, fileName: string): string {
  const parsed = path.parse(fileName)
  const normalizedBase = (parsed.name || 'headshot')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

  const safeBase = normalizedBase || 'headshot'
  return `${clientId}-${safeBase}${parsed.ext || '.jpg'}`
}

async function writeRedwoodHeadshotUploadFile(args: {
  clientId: string
  headshot: FetchDocumentResult
}): Promise<string> {
  const { clientId, headshot } = args
  const uploadsDir = path.join(process.cwd(), 'output', 'redwood', 'uploads')
  await fs.mkdir(uploadsDir, { recursive: true })

  const normalizedMime = headshot.mimeType.trim().toLowerCase()
  const canUploadAsIs = normalizedMime === 'image/jpeg' || normalizedMime === 'image/png' || normalizedMime === 'image/gif'

  if (canUploadAsIs) {
    const tempPath = path.join(uploadsDir, buildUploadFileName(clientId, headshot.filename))
    await fs.writeFile(tempPath, headshot.buffer)
    return tempPath
  }

  const convertedPath = path.join(uploadsDir, `${clientId}-headshot.jpg`)
  await sharp(headshot.buffer).flatten({ background: '#ffffff' }).jpeg({ quality: 92 }).toFile(convertedPath)
  return convertedPath
}

async function readDonorEditPhotoState(page: any): Promise<{
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

async function readDonorSaveResult(page: any): Promise<{
  bodyText: string
  hasSavedElement: boolean
  hasSavedMessage: boolean
  onDonorViewPage: boolean
}> {
  return await page.evaluate(() => {
    const bodyText = (document.body?.innerText || '').replace(/\s+/g, ' ').trim()
    const savedElement = document.getElementById('PageContent_pDonorSaved')

    return {
      bodyText,
      hasSavedElement: Boolean(savedElement?.textContent?.trim()),
      hasSavedMessage: /donor information saved successfully/i.test(bodyText),
      onDonorViewPage: /\/pages\/user\/donor\.aspx/i.test(window.location.pathname),
    }
  })
}

async function readRedwoodDonorMetadata(page: any): Promise<{
  donorId: string | null
  callInCode: string | null
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
      donorId,
      callInCode,
    }
  })
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
        // Try next target
      }
    }

    return false
  }, targets)
}

async function submitDonorSearch(page: any): Promise<boolean> {
  const waitForResultsNavigation = async (): Promise<boolean> => {
    await page.waitForLoadState('domcontentloaded', { timeout: 8000 }).catch(() => {})
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {})
    await page.waitForTimeout(800)
    return !/DonorSearch\.aspx/i.test(page.url())
  }

  const clicked = await clickFirstVisible(page, [
    '#PageContent_DonorSearchParameterForm1_Search',
    'input[name="ctl00$PageContent$DonorSearchParameterForm1$Search"]',
    'input[id*="DonorSearchParameterForm1_Search"]',
    'button:has-text("Search")',
    'input[type="submit"][value*="Search"]',
  ])

  if (clicked && (await waitForResultsNavigation())) {
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

  if (nativeClicked && (await waitForResultsNavigation())) {
    return true
  }

  const postbackSubmitted = await submitWithAspNetPostBack(page, [
    'ctl00$PageContent$DonorSearchParameterForm1$Search',
    'ctl00$PageContent$DonorSearchParameterForm1$btnSearch',
  ])

  if (postbackSubmitted && (await waitForResultsNavigation())) {
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

  return formSubmitted && (await waitForResultsNavigation())
}

async function captureRedwoodDiagnostic(page: any, prefix: string): Promise<string> {
  const outputPath = path.join(process.cwd(), 'output', 'redwood', 'screenshots', `${prefix}-${Date.now()}.png`)
  await fs.mkdir(path.dirname(outputPath), { recursive: true })
  await dismissCookieBanner(page)
  await page.screenshot({ path: outputPath, fullPage: true }).catch(() => undefined)
  return outputPath
}

async function openSearchResultsForLastName(args: {
  page: any
  donorSearchUrl: string
  lastName: string
  accountNumber?: string
}): Promise<void> {
  const { page, donorSearchUrl, lastName, accountNumber } = args
  const searchResultsUrl = buildRedwoodDonorSearchResultsUrl({
    donorSearchUrl,
    lastName: normalizeNameValue(lastName),
    accountNumber,
    active: true,
  })

  await page.goto(searchResultsUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })

  await page.waitForLoadState('domcontentloaded', { timeout: 20000 })
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {})
  await page.waitForTimeout(800)
}

async function openSearchResultsForUniqueId(args: {
  page: any
  donorSearchUrl: string
  uniqueId: string
  accountNumber?: string
}): Promise<void> {
  const { page, donorSearchUrl, uniqueId, accountNumber } = args
  const searchResultsUrl = buildRedwoodDonorSearchResultsUrl({
    donorSearchUrl,
    uniqueId,
    accountNumber,
    active: true,
  })

  await page.goto(searchResultsUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })

  await page.waitForLoadState('domcontentloaded', { timeout: 20000 })
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {})
  await page.waitForTimeout(800)
}

async function collectCandidates(page: any, accountNumber: string, client: {
  firstName: string
  lastName: string
  middleInitial?: string | null
  dob?: string | null
}) {
  const rows = page.locator('tr').filter({
    has: page.locator(VIEW_CONTROL_SELECTOR),
  })
  const rowCount = await rows.count()

  if (rowCount === 0) {
    throw new Error(`No Redwood donor rows found for last name "${client.lastName}"`)
  }

  const candidates: RedwoodCandidate[] = []

  for (let index = 0; index < rowCount; index++) {
    const row = rows.nth(index)
    const cells = (await row.locator('td').allTextContents()).map((cell) => cell.trim()).filter(Boolean)
    if (cells.length === 0) continue

    const matchedAccount = getAccountCell(cells)
    if (matchedAccount !== accountNumber) continue

    const nameCell = cells.find((cell) => cell.includes(',')) || cells[1] || cells[0]
    const parsedName = parseDonorName(nameCell)
    if (!parsedName) continue

    const score = calculateNameSimilarity(
      client.firstName,
      client.lastName,
      parsedName.firstName,
      parsedName.lastName,
      client.middleInitial || undefined,
      parsedName.middleInitial,
    )

    candidates.push({
      rowIndex: index,
      cells,
      firstName: parsedName.firstName,
      lastName: parsedName.lastName,
      middleInitial: parsedName.middleInitial,
      uniqueId: getUniqueIdCell(cells),
      dobKey: parseDateKey(getDobCell(cells)) || undefined,
      score,
    })
  }

  return { rows, candidates }
}

function selectBestCandidate(candidates: RedwoodCandidate[], clientDob?: string | null): RedwoodCandidate {
  if (candidates.length === 0) {
    throw new Error('No donor rows matched the allowed Redwood account')
  }

  const clientDobKey = parseDateKey(clientDob)

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

async function openCandidateDetail(page: any, rows: any, rowIndex: number): Promise<string | null> {
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

async function resolveDonorIdForClient(args: {
  accountNumber: string
  client: RedwoodDonorLookupClient
  donorSearchUrl: string
  page: any
}): Promise<string | null> {
  const { accountNumber, client, donorSearchUrl, page } = args

  if (client.redwoodDonorId?.trim()) {
    return client.redwoodDonorId.trim()
  }

  if (client.redwoodUniqueId?.trim()) {
    await openSearchResultsForUniqueId({
      page,
      donorSearchUrl,
      uniqueId: client.redwoodUniqueId.trim(),
      accountNumber,
    })

    let rows = page.locator('tr').filter({
      has: page.locator(VIEW_CONTROL_SELECTOR),
    })
    let rowCount = await rows.count()

    if (rowCount > 0) {
      let matchedRowIndex = -1
      for (let index = 0; index < rowCount; index++) {
        const cells = (await rows.nth(index).locator('td').allTextContents()).map((cell) => cell.trim()).filter(Boolean)
        if (getAccountCell(cells) !== accountNumber) continue
        if (getUniqueIdCell(cells)?.trim().toUpperCase() === client.redwoodUniqueId.trim().toUpperCase()) {
          matchedRowIndex = index
          break
        }
      }

      if (matchedRowIndex >= 0) {
        return await openCandidateDetail(page, rows, matchedRowIndex)
      }
    }
  }

  await openSearchResultsForLastName({
    page,
    donorSearchUrl,
    lastName: client.lastName,
    accountNumber,
  })

  const { rows, candidates } = await collectCandidates(page, accountNumber, client)
  const selectedCandidate = selectBestCandidate(candidates, client.dob)
  return await openCandidateDetail(page, rows, selectedCandidate.rowIndex)
}

async function enterEditMode(page: any): Promise<void> {
  const uniqueIdInputs = [
    '#PageContent_txtUniqueID',
    'input[name*="UniqueID"]',
    'input[name*="UniqueId"]',
    'input[id*="UniqueID"]',
    'input[id*="UniqueId"]',
  ]

  if (await waitForAnyVisible(page, uniqueIdInputs, 1000)) {
    return
  }

  await clickFirstVisible(page, [
    '#PageContent_btnEdit',
    'input[id*="Edit"]',
    'input[name*="Edit"]',
    'input[type="submit"][value*="Edit"]',
    'button:has-text("Edit")',
    'a:has-text("Edit")',
  ])

  await page.waitForLoadState('domcontentloaded', { timeout: 10000 }).catch(() => {})
  await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {})
  await page.waitForTimeout(400)
}

async function saveDonorRecord(page: any): Promise<void> {
  const saveSelectors = [
    '#PageContent_Donor_btnsave',
    '#PageContent_btnSave',
    'input[id*="btnsave"]',
    'input[name*="btnsave"]',
    'input[id*="Save"]',
    'input[name*="Save"]',
    'input[type="submit"][value*="Save"]',
    'button:has-text("Save")',
    'a:has-text("Save")',
  ]

  const nativeSaveClicked = await page
    .evaluate((selectors: string[]) => {
      for (const selector of selectors) {
        for (const element of Array.from(document.querySelectorAll(selector))) {
          const htmlElement = element as HTMLElement
          const isVisible = !!(htmlElement.offsetWidth || htmlElement.offsetHeight || htmlElement.getClientRects().length)
          if (!isVisible) continue
          htmlElement.click()
          return true
        }
      }

      return false
    }, saveSelectors)
    .catch(() => false)

  const saveClicked = nativeSaveClicked || (await clickFirstVisible(page, saveSelectors))

  if (!saveClicked) {
    throw new Error('Unable to find a Redwood donor save control')
  }

  await page.waitForLoadState('domcontentloaded', { timeout: 20000 }).catch(() => {})
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {})
  await page.waitForTimeout(1000)
}

async function collectUniqueIdValues(page: any): Promise<string[]> {
  return await page.evaluate(() => {
    const selectors = [
      '#PageContent_txtUniqueID',
      'input[name*="UniqueID"]',
      'input[name*="UniqueId"]',
      'input[id*="UniqueID"]',
      'input[id*="UniqueId"]',
      '#PageContent_lblUniqueID',
      '[id*="UniqueID"]',
    ]

    const values = new Set<string>()

    for (const selector of selectors) {
      for (const element of Array.from(document.querySelectorAll(selector))) {
        if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
          const value = element.value.trim()
          if (value) values.add(value)
          continue
        }

        const text = element.textContent?.trim()
        if (text) values.add(text)
      }
    }

    return Array.from(values)
  })
}

async function readDonorDefaultTestSelectionState(page: any): Promise<{
  availableCodes: string[]
  listingText: string | null
  selectedCodes: string[]
}> {
  return await page.evaluate(() => {
    const hiddenSelectedTests = document.getElementById(
      'PageContent_Donor_DefaultTestsPanel_testSelectionGridView_hiddenSelectedTests',
    ) as HTMLInputElement | null

    const dt = (window as unknown as {
      ToxAccess?: {
        DataTables?: Record<string, { fnSettings?: () => any }>
      }
    }).ToxAccess?.DataTables?.tblPageContent_Donor_DefaultTestsPanel_testSelectionGridView_gvTestSelection

    const settings = typeof dt?.fnSettings === 'function' ? dt.fnSettings() : null
    const availableCodes = Array.isArray(settings?.aoData)
      ? settings.aoData
          .map((row: any) => {
            const rowMarkup = String(row?._aData || '')
            const hiddenMatch = rowMarkup.match(/hiddenTestCode[^>]*value="([^"]+)"/i)
            if (hiddenMatch?.[1]) return hiddenMatch[1].trim()
            const rowText = row?.nTr?.textContent?.replace(/\s+/g, ' ').trim() || ''
            const cellMatch = rowText.match(/([A-Z0-9]{2,10})\s*$/)
            return cellMatch?.[1] || null
          })
          .filter((code: string | null): code is string => Boolean(code))
      : []

    return {
      availableCodes,
      listingText:
        document
          .getElementById('PageContent_Donor_DefaultTestsPanel_testSelectionGridView_gvTestSelection_wrapper')
          ?.textContent?.replace(/\s+/g, ' ')
          .match(/Listing\s+\d+\s*-\s*\d+\s+of\s+\d+/i)?.[0] || null,
      selectedCodes: (hiddenSelectedTests?.value || '')
        .split('||')
        .map((value) => value.trim())
        .filter(Boolean),
    }
  })
}

async function selectDonorDefaultTestCode(page: any, targetCode: string): Promise<{
  availableCodes: string[]
  currentPage: number
  pageCount: number
  selectedCodes: string[]
}> {
  const selection = await page.evaluate((rawTargetCode: string) => {
    const targetCode = rawTargetCode.trim().toUpperCase()
    const hiddenSelectedTests = document.getElementById(
      'PageContent_Donor_DefaultTestsPanel_testSelectionGridView_hiddenSelectedTests',
    ) as HTMLInputElement | null

    const dt = (window as unknown as {
      ToxAccess?: {
        DataTables?: Record<
          string,
          {
            fnSettings?: () => any
            fnPageChange?: (page: number) => void
            selectedTests?: string[]
          }
        >
      }
    }).ToxAccess?.DataTables?.tblPageContent_Donor_DefaultTestsPanel_testSelectionGridView_gvTestSelection

    const settings = typeof dt?.fnSettings === 'function' ? dt.fnSettings() : null
    if (!hiddenSelectedTests || !dt || !settings || !Array.isArray(settings.aoData)) {
      return { status: 'error' as const, message: 'Redwood donor default tests grid is not initialized.' }
    }

    const availableCodes = settings.aoData
      .map((row: any) => {
        const rowMarkup = String(row?._aData || '')
        const hiddenMatch = rowMarkup.match(/hiddenTestCode[^>]*value="([^"]+)"/i)
        if (hiddenMatch?.[1]) return hiddenMatch[1].trim().toUpperCase()
        const rowText = row?.nTr?.textContent?.replace(/\s+/g, ' ').trim() || ''
        const cellMatch = rowText.match(/([A-Z0-9]{2,10})\s*$/)
        return cellMatch?.[1]?.toUpperCase() || null
      })
      .filter((code: string | null): code is string => Boolean(code))

    const rowIndex = availableCodes.findIndex((code: string) => code === targetCode)
    if (rowIndex < 0) {
      return {
        status: 'missing' as const,
        availableCodes,
      }
    }

    const displayLength = Number(settings._iDisplayLength || 20)
    const currentPage = Math.floor(rowIndex / displayLength)

    const selectedCodes = (hiddenSelectedTests.value || '')
      .split('||')
      .map((value) => value.trim().toUpperCase())
      .filter(Boolean)

    if (!selectedCodes.includes(targetCode)) {
      selectedCodes.push(targetCode)
    }

    hiddenSelectedTests.value = selectedCodes.join('||')
    dt.selectedTests = selectedCodes

    if (typeof dt.fnPageChange === 'function') {
      dt.fnPageChange(currentPage)
    }

    return {
      status: 'selected' as const,
      availableCodes,
      currentPage,
      pageCount: Math.max(1, Math.ceil(availableCodes.length / displayLength)),
      selectedCodes,
    }
  }, targetCode)

  if (selection.status === 'error') {
    throw new Error(selection.message)
  }

  if (selection.status === 'missing') {
    throw new Error(
      `Redwood donor default-test code "${targetCode}" was not found. Available codes: ${selection.availableCodes.join(', ')}`,
    )
  }

  await page.waitForTimeout(500)

  await page.evaluate((selectedCodes: string[]) => {
    const selectedCodeSet = new Set(selectedCodes.map((code) => code.trim().toUpperCase()).filter(Boolean))
    const rows = Array.from(
      document.querySelectorAll('#PageContent_Donor_DefaultTestsPanel_testSelectionGridView_gvTestSelection tbody tr'),
    )

    for (const row of rows) {
      const checkbox = row.querySelector('input[type="checkbox"]') as HTMLInputElement | null
      const hidden = row.querySelector('input[id*="hiddenTestCode"]') as HTMLInputElement | null
      const rowCode =
        hidden?.value?.trim().toUpperCase() ||
        row.querySelector('td:nth-child(3)')?.textContent?.replace(/\s+/g, ' ').trim().toUpperCase() ||
        ''

      if (checkbox) {
        checkbox.checked = selectedCodeSet.has(rowCode)
      }
    }
  }, selection.selectedCodes)

  return {
    availableCodes: selection.availableCodes,
    currentPage: selection.currentPage,
    pageCount: selection.pageCount,
    selectedCodes: selection.selectedCodes,
  }
}

async function resolveRedwoodEnv() {
  const auth = resolveRedwoodAuthEnv()
  const donorSearchUrl = process.env.REDWOOD_DONOR_SEARCH_URL?.trim() || DEFAULT_REDWOOD_DONOR_SEARCH_URL

  return { ...auth, donorSearchUrl }
}

export async function backfillRedwoodClientUniqueId(args: {
  payload: Payload
  client: {
    id: string
    firstName: string
    lastName: string
    middleInitial?: string | null
    dob?: string | null
    redwoodUniqueId?: string | null
  }
  accountNumber: string
}) {
  const { client, accountNumber } = args
  const { username, password, loginUrl, donorSearchUrl } = await resolveRedwoodEnv()
  const browserState = await openRedwoodBrowserContext({ acceptDownloads: true })

  try {
    await loginToRedwood(browserState.page, { loginUrl, username, password })
    await openSearchResultsForLastName({
      page: browserState.page,
      donorSearchUrl,
      lastName: client.lastName,
      accountNumber,
    })

    const { rows, candidates } = await collectCandidates(browserState.page, accountNumber, client)
    const selectedCandidate = selectBestCandidate(candidates, client.dob)

    const donorId = await openCandidateDetail(browserState.page, rows, selectedCandidate.rowIndex)
    await dismissCookieBanner(browserState.page)
    await enterEditMode(browserState.page)

    const uniqueId = client.redwoodUniqueId?.trim()
    if (!uniqueId) {
      throw new Error('Client is missing redwoodUniqueId')
    }

    const uniqueIdFilled = await fillFirstVisibleInput(
      browserState.page,
      [
        '#PageContent_txtUniqueID',
        'input[name*="UniqueID"]',
        'input[name*="UniqueId"]',
        'input[id*="UniqueID"]',
        'input[id*="UniqueId"]',
      ],
      uniqueId,
    )

    if (!uniqueIdFilled) {
      const screenshotPath = await captureRedwoodDiagnostic(browserState.page, `redwood-unique-id-input-missing-${client.id}`)
      throw new Error(`Unable to find Redwood donor Unique ID field. Screenshot: ${screenshotPath}`)
    }

    await saveDonorRecord(browserState.page)

    const persistedUniqueIdTexts = await collectUniqueIdValues(browserState.page)
    const persistedMatch = persistedUniqueIdTexts.some((text) => text.includes(uniqueId))
    const screenshotPath = await captureRedwoodDiagnostic(browserState.page, `redwood-unique-id-saved-${client.id}`)

    if (!persistedMatch) {
      throw new Error(`Redwood donor Unique ID could not be verified after save. Screenshot: ${screenshotPath}`)
    }

    return {
      status: 'synced' as const,
      screenshotPath,
      matchedDonor: `${selectedCandidate.lastName}, ${selectedCandidate.firstName}`,
      donorId,
    }
  } catch (error) {
    const screenshotPath = await captureRedwoodDiagnostic(browserState.page, `redwood-unique-id-error-${client.id}`).catch(
      () => null,
    )
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(screenshotPath ? `${message} Screenshot: ${screenshotPath}` : message)
  } finally {
    await browserState.browser.close()
  }
}

export async function uploadClientHeadshotToRedwood(args: {
  client: {
    id: string
    firstName: string
    lastName: string
    redwoodUniqueId?: string
    redwoodDonorId?: string
    headshotId: string
  }
  payload: Payload
  accountNumber: string
}) {
  const { client, payload, accountNumber } = args
  const { username, password, loginUrl, donorSearchUrl } = await resolveRedwoodEnv()
  const headshot = await fetchDocument(client.headshotId, payload)
  const tempPath = await writeRedwoodHeadshotUploadFile({
    clientId: client.id,
    headshot,
  })

  const browserState = await openRedwoodBrowserContext({ acceptDownloads: true })

  try {
    await loginToRedwood(browserState.page, { loginUrl, username, password })
    const donorId = await resolveDonorIdForClient({
      accountNumber,
      client,
      donorSearchUrl,
      page: browserState.page,
    })

    if (donorId) {
      await browserState.page.goto(buildRedwoodDonorEditUrl(donorSearchUrl, donorId), {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      })
      await browserState.page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {})
      await browserState.page.waitForTimeout(800)
    }

    await dismissCookieBanner(browserState.page)
    await enterEditMode(browserState.page)

    const fileInput = browserState.page.locator(
      [
        '#PageContent_fuPhoto',
        '#PageContent_filePhoto',
        'input[type="file"][id*="Photo"]',
        'input[type="file"][name*="Photo"]',
        'input[type="file"][id*="Image"]',
        'input[type="file"][name*="Image"]',
        'input[type="file"]',
      ].join(', '),
    ).first()

    if ((await fileInput.count()) === 0) {
      const screenshotPath = await captureRedwoodDiagnostic(browserState.page, `redwood-headshot-input-missing-${client.id}`)
      throw new Error(`Unable to find Redwood donor photo upload field. Screenshot: ${screenshotPath}`)
    }

    await fileInput.setInputFiles(tempPath)
    await browserState.page.waitForTimeout(800)

    const stagedScreenshotPath = await captureRedwoodDiagnostic(browserState.page, `redwood-headshot-staged-${client.id}`)

    const maybeUploadClicked = await clickFirstVisible(browserState.page, [
      '#PageContent_btnUploadPhoto',
      'input[id*="Upload"][id*="Photo"]',
      'input[name*="Upload"][name*="Photo"]',
      'input[type="submit"][value*="Upload"]',
      'button:has-text("Upload")',
    ])

    if (maybeUploadClicked) {
      await browserState.page.waitForLoadState('domcontentloaded', { timeout: 10000 }).catch(() => {})
      await browserState.page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {})
      await browserState.page.waitForTimeout(800)
    }

    await saveDonorRecord(browserState.page)

    const saveResult = await readDonorSaveResult(browserState.page)
    const resolvedDonorId = donorId || extractRedwoodDonorIdFromUrl(browserState.page.url())

    if (!saveResult.onDonorViewPage || (!saveResult.hasSavedElement && !saveResult.hasSavedMessage)) {
      const savedScreenshotPath = await captureRedwoodDiagnostic(browserState.page, `redwood-headshot-saved-${client.id}`)
      throw new Error(
        `Redwood donor headshot upload did not complete successfully. Staged screenshot: ${stagedScreenshotPath}. Saved screenshot: ${savedScreenshotPath}`,
      )
    }

    if (resolvedDonorId) {
      await browserState.page.goto(buildRedwoodDonorEditUrl(donorSearchUrl, resolvedDonorId), {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      })
      await browserState.page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {})
      await browserState.page.waitForTimeout(800)
    }

    const editPhotoState = await readDonorEditPhotoState(browserState.page)
    const savedScreenshotPath = await captureRedwoodDiagnostic(browserState.page, `redwood-headshot-saved-${client.id}`)

    if (!editPhotoState.canRemovePhoto && editPhotoState.photoFlagValue !== 'true') {
      throw new Error(
        `Redwood donor headshot could not be verified on the donor edit page after save. Staged screenshot: ${stagedScreenshotPath}. Saved screenshot: ${savedScreenshotPath}`,
      )
    }

    if (resolvedDonorId) {
      await browserState.page.goto(buildRedwoodDonorViewUrl(donorSearchUrl, resolvedDonorId), {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      })
      await browserState.page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {})
      await browserState.page.waitForTimeout(800)
    }

    const donorMetadata = await readRedwoodDonorMetadata(browserState.page)

    return {
      status: 'synced' as const,
      screenshotPath: savedScreenshotPath,
      donorId: donorMetadata.donorId || resolvedDonorId,
      callInCode: donorMetadata.callInCode,
    }
  } catch (error) {
    const screenshotPath = await captureRedwoodDiagnostic(browserState.page, `redwood-headshot-error-${client.id}`).catch(
      () => null,
    )
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(screenshotPath ? `${message} Screenshot: ${screenshotPath}` : message)
  } finally {
    await browserState.browser.close()
    await fs.unlink(tempPath).catch(() => undefined)
  }
}

export async function syncClientDefaultLabTestInRedwood(args: {
  client: RedwoodDonorLookupClient & {
    id: string
  }
  payload: Payload
  accountNumber: string
  redwoodLabTestCode: string
}): Promise<{
  status: 'synced'
  screenshotPath: string
  donorId: string | null
  selectedCode: string
}> {
  const { client, payload, accountNumber, redwoodLabTestCode } = args
  const { username, password, loginUrl, donorSearchUrl } = await resolveRedwoodEnv()
  const browserState = await openRedwoodBrowserContext({ acceptDownloads: true })

  try {
    await loginToRedwood(browserState.page, { loginUrl, username, password })

    const donorId = await resolveDonorIdForClient({
      accountNumber,
      client,
      donorSearchUrl,
      page: browserState.page,
    })

    if (!donorId) {
      throw new Error('Unable to resolve Redwood donor ID for default-test sync.')
    }

    await browserState.page.goto(buildRedwoodDonorEditUrl(donorSearchUrl, donorId), {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    })
    await browserState.page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {})
    await browserState.page.waitForTimeout(800)
    await dismissCookieBanner(browserState.page)
    await enterEditMode(browserState.page)

    const panelState = await readDonorDefaultTestSelectionState(browserState.page)
    if (panelState.availableCodes.length === 0) {
      throw new Error('Redwood donor default-test grid did not expose any available lab test codes.')
    }

    const existingSelectedCodes = panelState.selectedCodes.map((code) => code.trim().toUpperCase())
    const selectionResult = await selectDonorDefaultTestCode(browserState.page, redwoodLabTestCode)
    await saveDonorRecord(browserState.page)

    const saveResult = await readDonorSaveResult(browserState.page)
    if (!saveResult.onDonorViewPage || (!saveResult.hasSavedElement && !saveResult.hasSavedMessage)) {
      const savedScreenshotPath = await captureRedwoodDiagnostic(
        browserState.page,
        `redwood-default-test-save-failed-${client.id}`,
      )
      throw new Error(`Redwood donor default-test save did not complete successfully. Screenshot: ${savedScreenshotPath}`)
    }

    await browserState.page.goto(buildRedwoodDonorEditUrl(donorSearchUrl, donorId), {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    })
    await browserState.page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {})
    await browserState.page.waitForTimeout(800)

    const persistedSelection = await readDonorDefaultTestSelectionState(browserState.page)
    const normalizedTargetCode = redwoodLabTestCode.trim().toUpperCase()
    const persisted = persistedSelection.selectedCodes.map((code) => code.toUpperCase())
    const screenshotPath = await captureRedwoodDiagnostic(browserState.page, `redwood-default-test-saved-${client.id}`)

    const missingPersistedCodes = selectionResult.selectedCodes.filter((code) => !persisted.includes(code))
    const lostExistingCodes = existingSelectedCodes.filter((code) => !persisted.includes(code))

    if (!persisted.includes(normalizedTargetCode) || missingPersistedCodes.length > 0 || lostExistingCodes.length > 0) {
      throw new Error(
        `Redwood donor default-test selection did not persist as expected. Expected to include "${selectionResult.selectedCodes.join(', ')}", received "${persistedSelection.selectedCodes.join(', ')}". Screenshot: ${screenshotPath}`,
      )
    }

    payload.logger.info({
      msg: '[redwood-default-test] Synced Redwood donor default test',
      clientId: client.id,
      donorId,
      redwoodLabTestCode: normalizedTargetCode,
      screenshotPath,
    })

    return {
      status: 'synced',
      screenshotPath,
      donorId,
      selectedCode: normalizedTargetCode,
    }
  } catch (error) {
    const screenshotPath = await captureRedwoodDiagnostic(browserState.page, `redwood-default-test-error-${client.id}`).catch(
      () => null,
    )
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(screenshotPath ? `${message} Screenshot: ${screenshotPath}` : message)
  } finally {
    await browserState.browser.close()
  }
}
