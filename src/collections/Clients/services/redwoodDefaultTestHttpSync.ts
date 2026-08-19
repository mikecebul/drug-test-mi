import { buildRedwoodDonorEditUrl } from '@/lib/redwood/donor-urls'
import {
  assertRedwoodDonorSaveResponse,
  createRedwoodHttpSession,
  getRedwoodFormEntry,
  parseRedwoodFormEntries,
  readRedwoodHtmlAttributes,
  removeRedwoodFormEntry,
  setRedwoodFormEntry,
  stripRedwoodHtml,
} from '@/lib/redwood/http'
import {
  assertRedwoodDonorAccountAllowed,
  resolveRedwoodDonorIdViaHttp,
} from '@/lib/redwood/http-donor-search'
import { resolveRedwoodAuthEnv } from '@/lib/redwood/auth'
import type { RedwoodDonorLookupClient } from '@/lib/redwood/donor-search'
import { getAllowedRedwoodAccountNumbers } from '@/lib/redwood/config'

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

export type RedwoodDefaultTestClearPlan = RedwoodDefaultTestSelectionState & {
  clearedCode: string
  entries: [string, string][]
  nextSelectedCodes: string[]
  selectionChanged: boolean
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
      (attributes) => /hiddentestcode/i.test(attributes.name || '') || /hiddentestcode/i.test(attributes.id || ''),
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

function readInheritedDefaultTestCodes(html: string): string[] {
  const codes: string[] = []
  const inheritedDefaultCellPattern =
    /(?:Agency|Donor Group) Default Test\(s\)[\s\S]*?<\/td>\s*<td\b[^>]*>([\s\S]*?)<\/td>/gi

  for (const match of html.matchAll(inheritedDefaultCellPattern)) {
    const cellText = stripRedwoodHtml(match[1] || '')
    for (const codeMatch of cellText.matchAll(/\(([A-Z0-9]{2,10})\)/gi)) {
      if (codeMatch[1]) codes.push(codeMatch[1])
    }
  }

  return uniqueCodes(codes)
}

function readDonorSelectedCodes(entries: [string, string][], rows: RedwoodDefaultTestRow[]): string[] {
  const hiddenSelectedCodes = splitSelectedCodes(
    getRedwoodFormEntry(entries, REDWOOD_DEFAULT_TEST_HIDDEN_SELECTED_FIELD),
  )
  const rowSelectedCodes = rows.filter((row) => row.selected).map((row) => row.code)

  return uniqueCodes([...hiddenSelectedCodes, ...rowSelectedCodes])
}

export function readRedwoodDefaultTestSelectionState(html: string): RedwoodDefaultTestSelectionState {
  const entries = parseRedwoodFormEntries(html)
  const rows = readDefaultTestRows(html)
  const donorSelectedCodes = readDonorSelectedCodes(entries, rows)
  const inheritedCodes = readInheritedDefaultTestCodes(html)
  const selectedCodes = uniqueCodes([...inheritedCodes, ...donorSelectedCodes])

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
  const inheritedCodes = readInheritedDefaultTestCodes(html)
  const donorSelectedCodes = readDonorSelectedCodes(entries, rows)

  if (rows.length === 0) {
    throw new Error('Redwood donor default-test grid did not expose any available lab test codes.')
  }

  const targetRow = rows.find((row) => row.code === targetCode)
  const targetAlreadySelected = state.selectedCodes.includes(targetCode)
  if (!targetRow && !targetAlreadySelected) {
    throw new Error(
      `Redwood donor default-test code "${targetCode}" was not found. Available codes: ${state.availableCodes.join(', ')}. Selected codes: ${state.selectedCodes.join(', ') || 'none'}`,
    )
  }

  const normalizedPreviousSyncedCode = normalizeTestCode(previousSyncedCode || '')
  const donorSelectedCodesWithoutPreviousSyncedCode =
    normalizedPreviousSyncedCode && normalizedPreviousSyncedCode !== targetCode
      ? donorSelectedCodes.filter((code) => code !== normalizedPreviousSyncedCode)
      : donorSelectedCodes
  const nextDonorSelectedCodes = inheritedCodes.includes(targetCode)
    ? donorSelectedCodesWithoutPreviousSyncedCode
    : uniqueCodes([...donorSelectedCodesWithoutPreviousSyncedCode, targetCode])
  const nextSelectedCodes = uniqueCodes([...inheritedCodes, ...nextDonorSelectedCodes])
  const selectionChanged = !sameCodeSet(donorSelectedCodes, nextDonorSelectedCodes)
  setRedwoodFormEntry(entries, REDWOOD_DEFAULT_TEST_HIDDEN_SELECTED_FIELD, nextDonorSelectedCodes.join('||'))

  const rowsByCode = new Map(rows.map((row) => [row.code, row]))
  const nextDonorSelectedCodeSet = new Set(nextDonorSelectedCodes)
  for (const row of rows) {
    if (row.checkboxName && !nextDonorSelectedCodeSet.has(row.code)) {
      removeRedwoodFormEntry(entries, row.checkboxName)
    }
  }

  for (const selectedCode of nextDonorSelectedCodes) {
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

export function buildRedwoodDefaultTestClearPlan(
  html: string,
  rawPreviouslySyncedCode: string,
): RedwoodDefaultTestClearPlan {
  const clearedCode = normalizeTestCode(rawPreviouslySyncedCode)
  if (!clearedCode) {
    throw new Error('Redwood default-test clearing requires the previously managed lab test code.')
  }

  const entries = parseRedwoodFormEntries(html)
  const rows = readDefaultTestRows(html)
  const state = readRedwoodDefaultTestSelectionState(html)
  const inheritedCodes = readInheritedDefaultTestCodes(html)
  const donorSelectedCodes = readDonorSelectedCodes(entries, rows)

  if (rows.length === 0) {
    throw new Error('Redwood donor default-test grid did not expose any available lab test codes.')
  }

  if (inheritedCodes.includes(clearedCode)) {
    throw new Error(
      `Redwood default-test code "${clearedCode}" is inherited from the donor's agency or donor group and cannot be cleared at the donor level.`,
    )
  }

  const nextDonorSelectedCodes = donorSelectedCodes.filter((code) => code !== clearedCode)
  const nextSelectedCodes = uniqueCodes([...inheritedCodes, ...nextDonorSelectedCodes])
  const selectionChanged = !sameCodeSet(donorSelectedCodes, nextDonorSelectedCodes)
  setRedwoodFormEntry(entries, REDWOOD_DEFAULT_TEST_HIDDEN_SELECTED_FIELD, nextDonorSelectedCodes.join('||'))

  const nextDonorSelectedCodeSet = new Set(nextDonorSelectedCodes)
  for (const row of rows) {
    if (!row.checkboxName) continue

    if (nextDonorSelectedCodeSet.has(row.code)) {
      setRedwoodFormEntry(entries, row.checkboxName, 'on')
    } else {
      removeRedwoodFormEntry(entries, row.checkboxName)
    }
  }

  return {
    ...state,
    clearedCode,
    entries,
    nextSelectedCodes,
    selectionChanged,
  }
}

function assertDefaultTestEditPage(html: string, donorId: string): void {
  if (/PageContent_Donor_DefaultTestsPanel_testSelectionGridView_gvTestSelection/.test(html)) return

  if (/Pages\/Public\/Login\.aspx/i.test(html)) {
    throw new Error('Redwood HTTP default-test sync was redirected to login while opening donor edit page.')
  }

  throw new Error(`Redwood donor edit page did not expose default-test fields for donor ${donorId}.`)
}

function assertDefaultTestPersisted(args: { expectedCodes: string[]; html: string }): void {
  const persisted = readRedwoodDefaultTestSelectionState(args.html).selectedCodes
  const missingCodes = args.expectedCodes.filter((code) => !persisted.includes(code))
  const extraCodes = persisted.filter((code) => !args.expectedCodes.includes(code))

  if (missingCodes.length > 0 || extraCodes.length > 0) {
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
  accountNumber: string
  donorId: string | null
  selectedCode: string
  status: 'synced'
}> {
  const auth = resolveRedwoodAuthEnv()
  const donorSearchUrl = process.env.REDWOOD_DONOR_SEARCH_URL?.trim() || DEFAULT_REDWOOD_DONOR_SEARCH_URL
  const session = await createRedwoodHttpSession(auth)
  const donorId = await resolveRedwoodDonorIdViaHttp({
    accountNumbers: getAllowedRedwoodAccountNumbers(),
    client: args.client,
    donorSearchUrl,
    session,
  })
  const editUrl = buildRedwoodDonorEditUrl(donorSearchUrl, donorId)

  const editPage = await session.getText(editUrl)
  assertDefaultTestEditPage(editPage.text, donorId)
  const accountNumber = assertRedwoodDonorAccountAllowed(editPage.text, donorId)
  const plan = buildRedwoodDefaultTestSelectionPlan(editPage.text, args.redwoodLabTestCode, args.previousSyncedCode)

  if (!plan.selectionChanged) {
    assertDefaultTestPersisted({
      expectedCodes: plan.nextSelectedCodes,
      html: editPage.text,
    })

    return {
      accountNumber,
      donorId,
      selectedCode: plan.targetCode,
      status: 'synced',
    }
  }

  setRedwoodFormEntry(plan.entries, REDWOOD_DONOR_SAVE_BUTTON, 'Save')
  const saveResponse = await session.postFormData(editUrl, plan.entries, { referer: editUrl })
  await assertRedwoodDonorSaveResponse(saveResponse, 'default-test save')

  const verificationPage = await session.getText(editUrl)
  assertDefaultTestEditPage(verificationPage.text, donorId)
  assertRedwoodDonorAccountAllowed(verificationPage.text, donorId)
  assertDefaultTestPersisted({
    expectedCodes: plan.nextSelectedCodes,
    html: verificationPage.text,
  })

  return {
    accountNumber,
    donorId,
    selectedCode: plan.targetCode,
    status: 'synced',
  }
}

export async function clearClientDefaultLabTestInRedwoodViaHttp(args: {
  accountNumber: string
  client: RedwoodDonorLookupClient & {
    id: string
  }
  previouslySyncedCode: string
}): Promise<{
  accountNumber: string
  donorId: string | null
  status: 'cleared'
}> {
  const auth = resolveRedwoodAuthEnv()
  const donorSearchUrl = process.env.REDWOOD_DONOR_SEARCH_URL?.trim() || DEFAULT_REDWOOD_DONOR_SEARCH_URL
  const session = await createRedwoodHttpSession(auth)
  const donorId = await resolveRedwoodDonorIdViaHttp({
    accountNumbers: getAllowedRedwoodAccountNumbers(),
    client: args.client,
    donorSearchUrl,
    session,
  })
  const editUrl = buildRedwoodDonorEditUrl(donorSearchUrl, donorId)

  const editPage = await session.getText(editUrl)
  assertDefaultTestEditPage(editPage.text, donorId)
  const accountNumber = assertRedwoodDonorAccountAllowed(editPage.text, donorId)
  const plan = buildRedwoodDefaultTestClearPlan(editPage.text, args.previouslySyncedCode)

  if (!plan.selectionChanged) {
    assertDefaultTestPersisted({
      expectedCodes: plan.nextSelectedCodes,
      html: editPage.text,
    })

    return { accountNumber, donorId, status: 'cleared' }
  }

  setRedwoodFormEntry(plan.entries, REDWOOD_DONOR_SAVE_BUTTON, 'Save')
  const saveResponse = await session.postFormData(editUrl, plan.entries, { referer: editUrl })
  await assertRedwoodDonorSaveResponse(saveResponse, 'default-test clear')

  const verificationPage = await session.getText(editUrl)
  assertDefaultTestEditPage(verificationPage.text, donorId)
  assertRedwoodDonorAccountAllowed(verificationPage.text, donorId)
  assertDefaultTestPersisted({
    expectedCodes: plan.nextSelectedCodes,
    html: verificationPage.text,
  })

  return { accountNumber, donorId, status: 'cleared' }
}
