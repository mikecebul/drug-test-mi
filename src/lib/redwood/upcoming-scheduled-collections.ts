import { resolveRedwoodAuthEnv } from './auth'
import { createRedwoodHttpSession, stripRedwoodHtml } from './http'

export const DEFAULT_REDWOOD_UPCOMING_COLLECTIONS_URL =
  'https://toxaccess.redwoodtoxicology.com/Pages/User/UpcomingScheduleCollection.aspx'

export type RedwoodUpcomingCollectionDay = {
  collectionDate: string
  female: number
  male: number
  total: number
  unspecified: number
}

function parseCells(rowHtml: string): string[] {
  return Array.from(rowHtml.matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)).map((match) =>
    stripRedwoodHtml(match[1] || ''),
  )
}

function normalizeDate(value: string): string {
  const match = value.trim().match(/(\d{1,2})[/-](\d{1,2})[/-](\d{4})/)
  if (!match) throw new Error(`ToxAccess returned an unsupported upcoming collection date: ${value}`)
  return `${match[3]}-${match[1].padStart(2, '0')}-${match[2].padStart(2, '0')}`
}

function count(value: string, label: string): number {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`ToxAccess returned an invalid ${label} collection count: ${value}`)
  }
  return parsed
}

export function parseUpcomingScheduledCollectionsHtml(html: string): RedwoodUpcomingCollectionDay[] {
  const rows = Array.from(html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)).map((match) => match[0])
  const headerIndex = rows.findIndex((row) => {
    const cells = parseCells(row).map((cell) => cell.toLowerCase())
    return (
      cells.includes('date') &&
      cells.includes('male') &&
      cells.includes('female') &&
      cells.includes('unspecified') &&
      cells.includes('total')
    )
  })
  if (headerIndex < 0) {
    throw new Error('ToxAccess Upcoming Scheduled Collections table headers changed or were not found.')
  }

  const headers = parseCells(rows[headerIndex]).map((cell) => cell.toLowerCase())
  const index = (name: string) => headers.indexOf(name)
  const parsed: RedwoodUpcomingCollectionDay[] = []

  for (const row of rows.slice(headerIndex + 1)) {
    const cells = parseCells(row)
    const rawDate = cells[index('date')]?.trim()
    if (!rawDate || !/\d{1,2}[/-]\d{1,2}[/-]\d{4}/.test(rawDate)) continue

    const day = {
      collectionDate: normalizeDate(rawDate),
      male: count(cells[index('male')] || '0', 'male'),
      female: count(cells[index('female')] || '0', 'female'),
      unspecified: count(cells[index('unspecified')] || '0', 'unspecified'),
      total: count(cells[index('total')] || '0', 'total'),
    }
    if (day.male + day.female + day.unspecified !== day.total) {
      throw new Error(`ToxAccess counts do not add up for ${day.collectionDate}.`)
    }
    parsed.push(day)
  }

  return parsed
}

export async function fetchUpcomingScheduledCollections(): Promise<RedwoodUpcomingCollectionDay[]> {
  const session = await createRedwoodHttpSession(resolveRedwoodAuthEnv())
  const url = process.env.REDWOOD_UPCOMING_COLLECTIONS_URL?.trim() || DEFAULT_REDWOOD_UPCOMING_COLLECTIONS_URL
  const { response, text } = await session.getText(url)
  if (!response.ok) {
    throw new Error(`ToxAccess Upcoming Scheduled Collections request failed with status ${response.status}.`)
  }
  return parseUpcomingScheduledCollectionsHtml(text)
}
