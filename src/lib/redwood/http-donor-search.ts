import { getAllowedRedwoodAccountNumbers } from '@/lib/redwood/config'
import {
  buildRedwoodDonorEditUrl,
  buildRedwoodDonorSearchResultsUrl,
  buildRedwoodDonorViewUrl,
} from '@/lib/redwood/donor-urls'
import {
  buildRedwoodDonorCandidates,
  selectBestRedwoodDonorCandidate,
  type RedwoodDonorLookupClient,
  type RedwoodDonorTableRow,
} from '@/lib/redwood/donor-search'
import {
  getRedwoodFormEntry,
  parseRedwoodFormEntries,
  stripRedwoodHtml,
  type RedwoodHttpSession,
} from '@/lib/redwood/http'

const REDWOOD_AGENCY_FIELD = 'ctl00$PageContent$Donor$ddlAgencies'
const REDWOOD_ACTIVE_FIELD = 'ctl00$PageContent$Donor$Active'

export type RedwoodHttpDonorSearchRow = RedwoodDonorTableRow & {
  donorId: string
}

export type RedwoodHttpResolvedDonor = {
  accountNumber: string
  callInCode?: string | null
  donorId: string
  matchedBy: 'name-dob'
  matchedDonorName: string | null
}

export type RedwoodDonorActiveStatus = 'active' | 'inactive' | 'unknown'

export type RedwoodHttpVerifiedDonor = RedwoodHttpResolvedDonor & {
  activeStatus: Exclude<RedwoodDonorActiveStatus, 'unknown'>
}

export type RedwoodHttpVerifiedDonorMatches = {
  active: RedwoodHttpVerifiedDonor | null
  inactive: RedwoodHttpVerifiedDonor | null
}

function readDonorIdFromRowHtml(rowHtml: string): string {
  return (
    rowHtml.match(/name="[^"]*hfDonorId"[^>]+value="([^"]+)"/i)?.[1] ||
    rowHtml.match(/value="([^"]+)"[^>]+name="[^"]*hfDonorId"/i)?.[1] ||
    ''
  ).trim()
}

export function readRedwoodDonorSearchResults(html: string): RedwoodHttpDonorSearchRow[] {
  const rows: RedwoodHttpDonorSearchRow[] = []

  for (const rowMatch of html.matchAll(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi)) {
    const rowHtml = rowMatch[0]
    const donorId = readDonorIdFromRowHtml(rowHtml)
    if (!donorId) continue

    const cells = Array.from(rowHtml.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi))
      .map((cellMatch) => stripRedwoodHtml(cellMatch[1] || ''))
      .filter(Boolean)

    rows.push({
      cells,
      donorId,
      rowIndex: rows.length,
    })
  }

  return rows
}

export function readRedwoodCallInCodeFromDonorView(html: string): string | null {
  const lines = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]*>/g, '\n')
    .replace(/&nbsp;/g, ' ')
    .split('\n')
    .map((line) => stripRedwoodHtml(line).replace(/\s+/g, ' ').trim())
    .filter(Boolean)

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]
    if (!/check-?in code\/pin:/i.test(line)) continue

    const inlineValue = line.split(':')[1]?.trim()
    if (inlineValue) return inlineValue

    const nextLine = lines[index + 1]?.trim()
    if (nextLine) return nextLine
  }

  return null
}

export function readRedwoodDonorAccountNumber(html: string): string | null {
  const accountNumber = getRedwoodFormEntry(parseRedwoodFormEntries(html), REDWOOD_AGENCY_FIELD)?.trim()
  return accountNumber || null
}

export function readRedwoodDonorActiveStatus(html: string): RedwoodDonorActiveStatus {
  const value = getRedwoodFormEntry(parseRedwoodFormEntries(html), REDWOOD_ACTIVE_FIELD)

  if (value === 'rdbActive') return 'active'
  if (value === 'rdbInActive') return 'inactive'
  return 'unknown'
}

export function assertRedwoodDonorAccountAllowed(html: string, donorId: string): string {
  const accountNumber = readRedwoodDonorAccountNumber(html)
  if (!accountNumber) {
    throw new Error(`Redwood donor ${donorId} did not expose its account number on the donor edit page.`)
  }

  const allowedAccountNumbers = getAllowedRedwoodAccountNumbers()
  if (!allowedAccountNumbers.includes(accountNumber)) {
    throw new Error(
      `Redwood donor ${donorId} belongs to account ${accountNumber}, which is not in REDWOOD_ALLOWED_ACCOUNT_NUMBERS (${allowedAccountNumbers.join(', ')}).`,
    )
  }

  return accountNumber
}

function getMatchedDonorName(row: RedwoodHttpDonorSearchRow): string | null {
  return row.cells.find((cell) => cell.includes(',')) || null
}

function isNonMatchSelectionError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return (
    /no donor rows matched/i.test(message) ||
    /no dob-verified redwood donor match found/i.test(message) ||
    /no confident name-only redwood donor match found/i.test(message)
  )
}

export async function findRedwoodDonorByNameDobViaHttp(args: {
  accountNumber: string
  active?: boolean
  client: Pick<RedwoodDonorLookupClient, 'dob' | 'firstName' | 'lastName' | 'middleInitial'>
  donorSearchUrl: string
  session: RedwoodHttpSession
}): Promise<RedwoodHttpResolvedDonor | null> {
  const { accountNumber, active = true, client, donorSearchUrl, session } = args
  const searchPage = await session.getText(
    buildRedwoodDonorSearchResultsUrl({
      accountNumber,
      active,
      donorSearchUrl,
      lastName: client.lastName,
    }),
  )
  const rows = readRedwoodDonorSearchResults(searchPage.text)
  if (rows.length === 0) return null

  const candidates = buildRedwoodDonorCandidates(rows, accountNumber, client)

  try {
    const selectedCandidate = selectBestRedwoodDonorCandidate(candidates, client.dob)
    const selectedRow = rows[selectedCandidate.rowIndex]
    if (!selectedRow?.donorId) {
      throw new Error('Redwood donor search selected a row without a donor ID.')
    }

    return {
      accountNumber,
      donorId: selectedRow.donorId,
      matchedBy: 'name-dob',
      matchedDonorName: getMatchedDonorName(selectedRow),
    }
  } catch (error) {
    if (isNonMatchSelectionError(error)) return null
    throw error
  }
}

export async function findRedwoodDonorByNameDobAcrossAccountsViaHttp(args: {
  accountNumbers: string[]
  active?: boolean
  client: Pick<RedwoodDonorLookupClient, 'dob' | 'firstName' | 'lastName' | 'middleInitial'>
  donorSearchUrl: string
  session: RedwoodHttpSession
}): Promise<RedwoodHttpResolvedDonor | null> {
  const { active = true } = args
  const accountNumbers = Array.from(new Set(args.accountNumbers.map((value) => value.trim()).filter(Boolean)))
  const matches: RedwoodHttpResolvedDonor[] = []

  for (const accountNumber of accountNumbers) {
    const match = await findRedwoodDonorByNameDobViaHttp({
      accountNumber,
      active,
      client: args.client,
      donorSearchUrl: args.donorSearchUrl,
      session: args.session,
    })
    if (match) matches.push(match)
  }

  const uniqueMatches = Array.from(new Map(matches.map((match) => [match.donorId, match])).values())

  if (uniqueMatches.length > 1) {
    throw new Error(
      `Multiple DOB-verified Redwood donor matches were found across accounts ${uniqueMatches
        .map(
          (match) => `${match.accountNumber} (donor ${match.donorId}, ${match.matchedDonorName || 'name unavailable'})`,
        )
        .join(', ')}; manual review required.`,
    )
  }

  return uniqueMatches[0] || null
}

function describeVerifiedDonor(match: RedwoodHttpVerifiedDonor): string {
  return `${match.activeStatus} donor ${match.donorId} (${match.matchedDonorName || 'name unavailable'}) in account ${match.accountNumber}`
}

async function verifyRedwoodDonorStatusViaHttp(args: {
  allowedAccountNumbers: string[]
  donorSearchUrl: string
  match: RedwoodHttpResolvedDonor
  session: RedwoodHttpSession
}): Promise<RedwoodHttpVerifiedDonor> {
  const editPage = await args.session.getText(buildRedwoodDonorEditUrl(args.donorSearchUrl, args.match.donorId))
  const accountNumber = readRedwoodDonorAccountNumber(editPage.text)
  if (!accountNumber) {
    throw new Error(
      `Redwood donor ${args.match.donorId} matched by name and DOB, but its account could not be verified from the donor edit page; manual review required.`,
    )
  }

  if (!args.allowedAccountNumbers.includes(accountNumber)) {
    throw new Error(
      `Redwood donor ${args.match.donorId} matched by name and DOB, but its verified account ${accountNumber} is not allowed; manual review required.`,
    )
  }

  const activeStatus = readRedwoodDonorActiveStatus(editPage.text)
  if (activeStatus === 'unknown') {
    throw new Error(
      `Redwood donor ${args.match.donorId} matched by name and DOB, but its active status could not be verified from the donor edit page; manual review required.`,
    )
  }

  return {
    ...args.match,
    accountNumber,
    activeStatus,
  }
}

export async function findExistingRedwoodDonorMatchesViaHttp(
  args: Omit<Parameters<typeof findRedwoodDonorByNameDobAcrossAccountsViaHttp>[0], 'active'>,
): Promise<RedwoodHttpVerifiedDonorMatches> {
  const accountNumbers = Array.from(new Set(args.accountNumbers.map((value) => value.trim()).filter(Boolean)))
  const activeSearchMatch = await findRedwoodDonorByNameDobAcrossAccountsViaHttp({
    ...args,
    accountNumbers,
    active: true,
  })
  const inactiveSearchMatch = await findRedwoodDonorByNameDobAcrossAccountsViaHttp({
    ...args,
    accountNumbers,
    active: false,
  })
  const uniqueSearchMatches = Array.from(
    new Map(
      [activeSearchMatch, inactiveSearchMatch]
        .filter((match): match is RedwoodHttpResolvedDonor => Boolean(match))
        .map((match) => [match.donorId, match]),
    ).values(),
  )
  const verifiedMatches: RedwoodHttpVerifiedDonor[] = []

  for (const match of uniqueSearchMatches) {
    verifiedMatches.push(
      await verifyRedwoodDonorStatusViaHttp({
        allowedAccountNumbers: accountNumbers,
        donorSearchUrl: args.donorSearchUrl,
        match,
        session: args.session,
      }),
    )
  }

  const activeMatches = verifiedMatches.filter((match) => match.activeStatus === 'active')
  const inactiveMatches = verifiedMatches.filter((match) => match.activeStatus === 'inactive')

  for (const matches of [activeMatches, inactiveMatches]) {
    if (matches.length > 1) {
      throw new Error(
        `Multiple DOB-verified Redwood donor matches remained after edit-page status verification: ${matches
          .map(describeVerifiedDonor)
          .join('; ')}; manual review required.`,
      )
    }
  }

  return {
    active: activeMatches[0] || null,
    inactive: inactiveMatches[0] || null,
  }
}

export async function resolveRedwoodDonorIdViaHttp(args: {
  accountNumbers: string[]
  client: RedwoodDonorLookupClient
  donorSearchUrl: string
  session: RedwoodHttpSession
}): Promise<string> {
  const donorId = args.client.redwoodDonorId?.trim()
  if (donorId) return donorId

  const nameDobMatch = await findRedwoodDonorByNameDobAcrossAccountsViaHttp({
    accountNumbers: args.accountNumbers,
    active: true,
    client: args.client,
    donorSearchUrl: args.donorSearchUrl,
    session: args.session,
  })
  if (nameDobMatch?.donorId) return nameDobMatch.donorId

  throw new Error('Unable to resolve Redwood donor ID from donor ID or active name/DOB search across allowed accounts.')
}

export async function readRedwoodCallInCodeViaHttp(args: {
  donorId: string
  donorSearchUrl: string
  session: RedwoodHttpSession
}): Promise<string | null> {
  const donorView = await args.session.getText(buildRedwoodDonorViewUrl(args.donorSearchUrl, args.donorId))
  return readRedwoodCallInCodeFromDonorView(donorView.text)
}
