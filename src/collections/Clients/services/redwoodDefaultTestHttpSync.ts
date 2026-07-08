import { buildRedwoodDonorEditUrl } from '@/lib/redwood/donor-urls'
import {
  createRedwoodHttpSession,
  getRedwoodFormEntry,
  parseRedwoodFormEntries,
  readRedwoodHtmlAttributes,
  removeRedwoodFormEntry,
  setRedwoodFormEntry,
  stripRedwoodHtml,
} from '@/lib/redwood/http'
import { resolveRedwoodDonorIdViaHttp } from '@/lib/redwood/http-donor-search'
import { resolveRedwoodAuthEnv } from '@/lib/redwood/playwright'
import type { RedwoodDonorLookupClient } from '@/lib/redwood/donor-search'

const DEFAULT_REDWOOD_DONOR_SEARCH_URL = 'https://toxaccess.redwoodtoxicology.com/Pages/User/DonorSearch.aspx'

const REDWOOD_DEFAULT_TEST_HIDDEN_SELECTED_FIELD =
  'ctl00$PageContent$Donor$DefaultTestsPanel$testSelectionGridView$hiddenSelectedTests'
const REDWOOD_DONOR_SAVE_BUTTON = 'ctl00$PageContent$Donor$btnsave'

type RedwoodDefaultTestRow = {
  checkboxName: string | null
  code: string
  selected: boolean
}

export type RedwoodDefaultTestSelectionState = {
  availableCodes: string[]
  selectedCodes: string[]
}

export type RedwoodDefaultTestSelectionPlan = RedwoodDefaultTestSelectionState & {
  entries: [string, string][]
  nextSelectedCodes: string[]
  selectionChanged: boolean
  targetAlreadySelected: boolean
  targetCode: string
}

function normalizeTestCode(value: string): string {
  return value.trim().toUpperCase()
}

function uniqueCodes(values: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []

  for (const value of values) {
    const normalized = normalizeTestCode(value)
    if (!normalized || seen.has(normalized)) continue

    seen.add(normalized)
    result.push(normalized)
  }

  return result
}

function readDefaultTestRows(html: string): RedwoodDefaultTestRow[] {
  return Array.from(html.matchAll(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi)).flatMap((rowMatch) => {
    const rowHtml = rowMatch[0]
    const inputs = Array.from(rowHtml.matchAll(/<input\b[^>]*>/gi)).map((inputMatch) =>
      readRedwoodHtmlAttributes(inputMatch[0]),
    )

    const hiddenCodeInput = inputs.find(
      (attributes) =>
        /hiddentestcode/i.test(attributes.name || '') || /hiddentestcode/i.test(attributes.id || ''),
    )
    const code = normalizeTestCode(hiddenCodeInput?.value || '')
    if (!code) return []

    const checkbox = inputs.find((attributes) => (attributes.type || '').toLowerCase() === 'checkbox')

    return [
      {
        checkboxName: checkbox?.name || null,
        code,
        selected: Boolean(checkbox && 'checked' in checkbox),
      },
    ]
  })
}

function splitSelectedCodes(value: string | undefined): string[] {
  return uniqueCodes(
    (value || '')
      .split('||')
      .map((code) => code.trim())
      .filter(Boolean),
  )
}

export function readRedwoodDefaultTestSelectionState(html: string): RedwoodDefaultTestSelectionState {
  const entries = parseRedwoodFormEntries(html)
  const rows = readDefaultTestRows(html)
  const hiddenSelectedCodes = splitSelectedCodes(getRedwoodFormEntry(entries, REDWOOD_DEFAULT_TEST_HIDDEN_SELECTED_FIELD))
  const rowSelectedCodes = rows.filter((row) => row.selected).map((row) => row.code)
  const selectedCodes = uniqueCodes([...hiddenSelectedCodes, ...rowSelectedCodes])

  return {
    availableCodes: rows.map((row) => row.code),
    selectedCodes,
  }
}

function sameCodeSet(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false

  const rightSet = new Set(right)
  return left.every((code) => rightSet.has(code))
}

export function buildRedwoodDefaultTestSelectionPlan(
  html: string,
  rawTargetCode: string,
  previousSyncedCode?: string | null,
): RedwoodDefaultTestSelectionPlan {
  const targetCode = normalizeTestCode(rawTargetCode)
  if (!targetCode) {
    throw new Error('Redwood default-test sync requires a lab test code.')
  }

  const entries = parseRedwoodFormEntries(html)
  const rows = readDefaultTestRows(html)
  const state = readRedwoodDefaultTestSelectionState(html)

  if (rows.length === 0) {
    throw new Error('Redwood donor default-test grid did not expose any available lab test codes.')
  }

  const targetRow = rows.find((row) => row.code === targetCode)
  if (!targetRow) {
    throw new Error(`Redwood donor default-test code "${targetCode}" was not found. Available codes: ${state.availableCodes.join(', ')}`)
  }

  const targetAlreadySelected = state.selectedCodes.includes(targetCode)
  const normalizedPreviousSyncedCode = normalizeTestCode(previousSyncedCode || '')
  const selectedCodesWithoutPreviousSyncedCode =
    normalizedPreviousSyncedCode && normalizedPreviousSyncedCode !== targetCode
      ? state.selectedCodes.filter((code) => code !== normalizedPreviousSyncedCode)
      : state.selectedCodes
  const nextSelectedCodes = uniqueCodes([...selectedCodesWithoutPreviousSyncedCode, targetCode])
  const selectionChanged = !sameCodeSet(state.selectedCodes, nextSelectedCodes)
  setRedwoodFormEntry(entries, REDWOOD_DEFAULT_TEST_HIDDEN_SELECTED_FIELD, nextSelectedCodes.join('||'))

  const rowsByCode = new Map(rows.map((row) => [row.code, row]))
  const nextSelectedCodeSet = new Set(nextSelectedCodes)
  for (const row of rows) {
    if (row.checkboxName && !nextSelectedCodeSet.has(row.code)) {
      removeRedwoodFormEntry(entries, row.checkboxName)
    }
  }

  for (const selectedCode of nextSelectedCodes) {
    const checkboxName = rowsByCode.get(selectedCode)?.checkboxName
    if (checkboxName) {
      setRedwoodFormEntry(entries, checkboxName, 'on')
    }
  }

  return {
    ...state,
    entries,
    nextSelectedCodes,
    selectionChanged,
    targetAlreadySelected,
    targetCode,
  }
}

function assertDefaultTestEditPage(html: string, donorId: string): void {
  if (/PageContent_Donor_DefaultTestsPanel_testSelectionGridView_gvTestSelection/.test(html)) return

  if (/Pages\/Public\/Login\.aspx/i.test(html)) {
    throw new Error('Redwood HTTP default-test sync was redirected to login while opening donor edit page.')
  }

  throw new Error(`Redwood donor edit page did not expose default-test fields for donor ${donorId}.`)
}

function assertDefaultTestPersisted(args: {
  expectedCodes: string[]
  html: string
  targetCode: string
}): void {
  const persisted = readRedwoodDefaultTestSelectionState(args.html).selectedCodes
  const missingCodes = args.expectedCodes.filter((code) => !persisted.includes(code))
  const extraCodes = persisted.filter((code) => !args.expectedCodes.includes(code))

  if (!persisted.includes(args.targetCode) || missingCodes.length > 0 || extraCodes.length > 0) {
    throw new Error(
      `Redwood donor default-test selection did not persist as expected. Expected "${args.expectedCodes.join(', ')}", received "${persisted.join(', ')}".`,
    )
  }
}

export async function syncClientDefaultLabTestInRedwoodViaHttp(args: {
  accountNumber: string
  client: RedwoodDonorLookupClient & {
    id: string
  }
  previousSyncedCode?: string | null
  redwoodLabTestCode: string
}): Promise<{
  donorId: string | null
  screenshotPath: string
  selectedCode: string
  status: 'synced'
}> {
  const auth = resolveRedwoodAuthEnv()
  const donorSearchUrl = process.env.REDWOOD_DONOR_SEARCH_URL?.trim() || DEFAULT_REDWOOD_DONOR_SEARCH_URL
  const session = await createRedwoodHttpSession(auth)
  const donorId = await resolveRedwoodDonorIdViaHttp({
    accountNumber: args.accountNumber,
    client: args.client,
    donorSearchUrl,
    session,
  })
  const editUrl = buildRedwoodDonorEditUrl(donorSearchUrl, donorId)

  const editPage = await session.getText(editUrl)
  assertDefaultTestEditPage(editPage.text, donorId)
  const plan = buildRedwoodDefaultTestSelectionPlan(editPage.text, args.redwoodLabTestCode, args.previousSyncedCode)

  if (!plan.selectionChanged) {
    assertDefaultTestPersisted({
      expectedCodes: plan.nextSelectedCodes,
      html: editPage.text,
      targetCode: plan.targetCode,
    })

    return {
      donorId,
      screenshotPath: '',
      selectedCode: plan.targetCode,
      status: 'synced',
    }
  }

  setRedwoodFormEntry(plan.entries, REDWOOD_DONOR_SAVE_BUTTON, 'Save')
  const saveResponse = await session.postFormData(editUrl, plan.entries, { referer: editUrl })
  const saveLocation = saveResponse.headers.get('location')
  if (saveResponse.status !== 302 || !saveLocation || !/Donor\.aspx/i.test(saveLocation)) {
    const body = await saveResponse.text().catch(() => '')
    throw new Error(
      `Redwood donor direct HTTP default-test save failed with status ${saveResponse.status}: ${stripRedwoodHtml(body).slice(0, 500)}`,
    )
  }

  const verificationPage = await session.getText(editUrl)
  assertDefaultTestEditPage(verificationPage.text, donorId)
  assertDefaultTestPersisted({
    expectedCodes: plan.nextSelectedCodes,
    html: verificationPage.text,
    targetCode: plan.targetCode,
  })

  return {
    donorId,
    screenshotPath: '',
    selectedCode: plan.targetCode,
    status: 'synced',
  }
}
