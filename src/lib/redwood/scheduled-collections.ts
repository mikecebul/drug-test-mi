import { resolveRedwoodAuthEnv } from './auth'
import { createRedwoodHttpSession, readRedwoodHtmlAttributes, stripRedwoodHtml } from './http'

export const DEFAULT_REDWOOD_SCHEDULED_COLLECTIONS_URL =
  'https://toxaccess.redwoodtoxicology.com/Pages/User/ScheduledCollections.aspx'

export type RedwoodScheduledCollection = {
  agency: string
  donorGroup: string
  donorId: string
  donorName: string
  testType: string
}

function parseCells(rowHtml: string): string[] {
  return Array.from(rowHtml.matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)).map((match) =>
    stripRedwoodHtml(match[1] || ''),
  )
}

function parseDonorId(rowHtml: string): string | null {
  for (const match of rowHtml.matchAll(/<input\b[^>]*>/gi)) {
    const attributes = readRedwoodHtmlAttributes(match[0])
    if (attributes.name?.toLowerCase().endsWith('$donorid') && attributes.value?.trim()) {
      return attributes.value.trim()
    }
  }
  return null
}

function hasExplicitEmptyState(html: string): boolean {
  const text = stripRedwoodHtml(html)
  const isScheduledCollectionsPage =
    /\bscheduled collections\b/i.test(text) || /ScheduledCollections\.aspx/i.test(html)

  if (!isScheduledCollectionsPage) {
    return false
  }

  return [
    /\bno scheduled collections(?:\s+(?:are\s+)?(?:available|found|to display))?\b/i,
    /\bno (?:data|records|results)(?:\s+were)?\s+(?:available|found|to display)\b/i,
    /\bthere are no (?:scheduled collections|data|records|results)\b/i,
  ].some((pattern) => pattern.test(text))
}

export function parseScheduledCollectionsHtml(html: string): RedwoodScheduledCollection[] {
  const rows = Array.from(html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)).map((match) => match[0])
  const headerIndex = rows.findIndex((row) => {
    const cells = parseCells(row).map((cell) => cell.toLowerCase())
    return (
      cells.includes('agency') &&
      cells.includes('donor group') &&
      cells.includes('identification') &&
      cells.includes('test type')
    )
  })

  if (headerIndex < 0) {
    if (hasExplicitEmptyState(html)) {
      return []
    }
    throw new Error('ToxAccess Scheduled Collections table headers changed or were not found.')
  }

  const headers = parseCells(rows[headerIndex]).map((cell) => cell.toLowerCase())
  const agencyIndex = headers.indexOf('agency')
  const groupIndex = headers.indexOf('donor group')
  const identificationIndex = headers.indexOf('identification')
  const testTypeIndex = headers.indexOf('test type')
  const parsed: RedwoodScheduledCollection[] = []
  const seenDonorIds = new Set<string>()

  for (const row of rows.slice(headerIndex + 1)) {
    const donorId = parseDonorId(row)
    if (!donorId) continue

    const cells = parseCells(row)
    const donorName = cells[identificationIndex]?.trim()
    if (!donorName) {
      throw new Error(`ToxAccess scheduled collection ${donorId} is missing its Identification value.`)
    }
    if (seenDonorIds.has(donorId)) {
      throw new Error(`ToxAccess returned duplicate scheduled donor ID ${donorId}.`)
    }

    seenDonorIds.add(donorId)
    parsed.push({
      agency: cells[agencyIndex]?.trim() || '',
      donorGroup: cells[groupIndex]?.trim() || '',
      donorId,
      donorName,
      testType: cells[testTypeIndex]?.trim() || '',
    })
  }

  return parsed
}

export async function fetchTodaysScheduledCollections(): Promise<RedwoodScheduledCollection[]> {
  const auth = resolveRedwoodAuthEnv()
  const session = await createRedwoodHttpSession(auth)
  const url = process.env.REDWOOD_SCHEDULED_COLLECTIONS_URL?.trim() || DEFAULT_REDWOOD_SCHEDULED_COLLECTIONS_URL
  const { response, text } = await session.getText(url)

  if (!response.ok) {
    throw new Error(`ToxAccess Scheduled Collections request failed with status ${response.status}.`)
  }

  return parseScheduledCollectionsHtml(text)
}
