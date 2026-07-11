import type { RedwoodMatchBy } from '@/lib/redwood/csv'
import { buildRedwoodDonorSearchResultsUrl, buildRedwoodDonorViewUrl } from '@/lib/redwood/donor-urls'
import {
  buildRedwoodDonorCandidates,
  selectBestRedwoodDonorCandidate,
  type RedwoodDonorLookupClient,
  type RedwoodDonorTableRow,
} from '@/lib/redwood/donor-search'
import { stripRedwoodHtml, type RedwoodHttpSession } from '@/lib/redwood/http'

export type RedwoodHttpDonorSearchRow = RedwoodDonorTableRow & {
  donorId: string
}

export type RedwoodHttpResolvedDonor = {
  callInCode?: string | null
  donorId: string
  matchedBy: RedwoodMatchBy
  matchedDonorName: string | null
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

function getMatchedDonorName(row: RedwoodHttpDonorSearchRow): string | null {
  return row.cells.find((cell) => cell.includes(',')) || null
}

function rowMatchesAllowedAccount(row: RedwoodHttpDonorSearchRow, accountNumber: string): boolean {
  return row.cells.join(' ').includes(accountNumber.trim())
}

export async function findRedwoodDonorByUniqueIdViaHttp(args: {
  accountNumber: string
  active?: boolean
  donorSearchUrl: string
  session: RedwoodHttpSession
  uniqueId: string
}): Promise<RedwoodHttpResolvedDonor | null> {
  const { accountNumber, active = true, donorSearchUrl, session, uniqueId } = args
  const searchPage = await session.getText(
    buildRedwoodDonorSearchResultsUrl({
      accountNumber,
      active,
      donorSearchUrl,
      uniqueId,
    }),
  )
  const rows = readRedwoodDonorSearchResults(searchPage.text)
  const normalizedUniqueId = uniqueId.trim().toUpperCase()
  if (!normalizedUniqueId) return null

  const match = rows.find((row) => {
    const rowText = row.cells.join(' ').toUpperCase()
    return rowText.includes(normalizedUniqueId) && rowMatchesAllowedAccount(row, accountNumber)
  })

  if (!match) return null

  return {
    donorId: match.donorId,
    matchedBy: 'unique-id',
    matchedDonorName: getMatchedDonorName(match),
  }
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
      donorId: selectedRow.donorId,
      matchedBy: 'name-dob',
      matchedDonorName: selectedCandidate.displayName,
    }
  } catch (error) {
    if (isNonMatchSelectionError(error)) return null
    throw error
  }
}

export async function findExistingRedwoodDonorViaHttp(args: {
  active: boolean
  accountNumber: string
  client: RedwoodDonorLookupClient
  donorSearchUrl: string
  session: RedwoodHttpSession
}): Promise<RedwoodHttpResolvedDonor | null> {
  const uniqueId = args.client.redwoodUniqueId?.trim()

  if (uniqueId) {
    const uniqueIdMatch = await findRedwoodDonorByUniqueIdViaHttp({
      accountNumber: args.accountNumber,
      active: args.active,
      donorSearchUrl: args.donorSearchUrl,
      session: args.session,
      uniqueId,
    })
    if (uniqueIdMatch) return uniqueIdMatch
  }

  return findRedwoodDonorByNameDobViaHttp({
    accountNumber: args.accountNumber,
    active: args.active,
    client: args.client,
    donorSearchUrl: args.donorSearchUrl,
    session: args.session,
  })
}

export async function findExistingActiveRedwoodDonorViaHttp(
  args: Omit<Parameters<typeof findExistingRedwoodDonorViaHttp>[0], 'active'>,
): Promise<RedwoodHttpResolvedDonor | null> {
  return findExistingRedwoodDonorViaHttp({ ...args, active: true })
}

export async function findExistingInactiveRedwoodDonorViaHttp(
  args: Omit<Parameters<typeof findExistingRedwoodDonorViaHttp>[0], 'active'>,
): Promise<RedwoodHttpResolvedDonor | null> {
  return findExistingRedwoodDonorViaHttp({ ...args, active: false })
}

export async function resolveRedwoodDonorIdViaHttp(args: {
  accountNumber: string
  client: RedwoodDonorLookupClient
  donorSearchUrl: string
  session: RedwoodHttpSession
}): Promise<string> {
  const donorId = args.client.redwoodDonorId?.trim()
  if (donorId) return donorId

  const uniqueId = args.client.redwoodUniqueId?.trim()
  if (uniqueId) {
    const uniqueIdMatch = await findRedwoodDonorByUniqueIdViaHttp({
      accountNumber: args.accountNumber,
      active: true,
      donorSearchUrl: args.donorSearchUrl,
      session: args.session,
      uniqueId,
    })
    if (uniqueIdMatch?.donorId) return uniqueIdMatch.donorId
  }

  const nameDobMatch = await findRedwoodDonorByNameDobViaHttp({
    accountNumber: args.accountNumber,
    active: true,
    client: args.client,
    donorSearchUrl: args.donorSearchUrl,
    session: args.session,
  })
  if (nameDobMatch?.donorId) return nameDobMatch.donorId

  throw new Error('Unable to resolve Redwood donor ID from donor ID, unique ID, or active name/DOB search.')
}

export async function readRedwoodCallInCodeViaHttp(args: {
  donorId: string
  donorSearchUrl: string
  session: RedwoodHttpSession
}): Promise<string | null> {
  const donorView = await args.session.getText(buildRedwoodDonorViewUrl(args.donorSearchUrl, args.donorId))
  return readRedwoodCallInCodeFromDonorView(donorView.text)
}
