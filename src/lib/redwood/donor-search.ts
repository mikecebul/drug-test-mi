import { calculateNameSimilarity } from '@/views/DrugTestWizard/utils/calculateSimilarity'

const DONOR_AMBIGUOUS_SCORE_DELTA = 0.02
const NAME_ONLY_MIN_SCORE = 0.85

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
  if (!value?.trim()) return null

  const trimmed = value.trim()
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10)

  const parsed = new Date(
    trimmed
      .replace(/,\s*/g, ' ')
      .replace(/(\d)(AM|PM)/gi, '$1 $2')
      .replace(/\s+/g, ' ')
      .trim(),
  )
  if (Number.isNaN(parsed.getTime())) return null

  const year = parsed.getFullYear()
  const month = String(parsed.getMonth() + 1).padStart(2, '0')
  const day = String(parsed.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function parseRedwoodDonorName(rawName: string): {
  firstName: string
  lastName: string
  middleInitial?: string
} | null {
  const cleaned = normalizeRedwoodNameValue(rawName)
  if (!cleaned) return null

  if (cleaned.includes(',')) {
    const [lastRaw, firstRaw] = cleaned.split(',', 2)
    const firstParts = normalizeRedwoodNameValue(firstRaw || '')
      .split(' ')
      .filter(Boolean)
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
    if (/^\d{6}$/.test(trimmed)) return trimmed

    const embeddedAccountMatch = trimmed.match(/\((\d{6})\)/)
    if (embeddedAccountMatch?.[1]) return embeddedAccountMatch[1]
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

export function buildRedwoodDonorCandidates(
  rows: RedwoodDonorTableRow[],
  accountNumber: string,
  client: Pick<RedwoodDonorLookupClient, 'dob' | 'firstName' | 'lastName' | 'middleInitial'>,
): RedwoodDonorCandidate[] {
  return rows.flatMap((row) => {
    if (getRedwoodAccountCell(row.cells) !== accountNumber) return []

    const nameCell = row.cells.find((cell) => cell.includes(',')) || row.cells[1] || row.cells[0]
    const parsedName = parseRedwoodDonorName(nameCell)
    if (!parsedName) return []

    return [
      {
        cells: row.cells,
        displayName: `${parsedName.lastName}, ${parsedName.firstName}`,
        dobKey: parseRedwoodDateKey(getRedwoodDobCell(row.cells)) || undefined,
        firstName: parsedName.firstName,
        lastName: parsedName.lastName,
        middleInitial: parsedName.middleInitial,
        rowIndex: row.rowIndex,
        score: calculateNameSimilarity(
          client.firstName,
          client.lastName,
          parsedName.firstName,
          parsedName.lastName,
          client.middleInitial || undefined,
          parsedName.middleInitial,
        ),
      },
    ]
  })
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
    const dobMatches = candidates
      .filter((candidate) => candidate.dobKey === clientDobKey)
      .sort((a, b) => b.score - a.score)

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
