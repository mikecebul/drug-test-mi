import { calculateNameSimilarity } from '@/views/DrugTestWizard/utils/calculateSimilarity'

type ClientName = {
  firstName?: string | null
  lastName?: string | null
  middleInitial?: string | null
}

type ParsedName = {
  firstName: string
  lastName: string
  middleInitial?: string
}

export type ReportClientMatch =
  | {
      status: 'match'
      score: number
      reportName: string
      clientName: string
    }
  | {
      status: 'mismatch'
      score: number
      reportName: string
      clientName: string
    }
  | {
      status: 'unknown'
      reportName: string | null
      clientName: string
    }

export function getReportClientMismatchKey(match: ReportClientMatch | null | undefined) {
  if (!match || match.status !== 'mismatch') return null
  return `${match.reportName.trim().toLowerCase()}::${match.clientName.trim().toLowerCase()}`
}

const MATCH_THRESHOLD = 0.9
const SUFFIXES = new Set(['jr', 'sr', 'ii', 'iii', 'iv', 'v'])

function normalizeNamePart(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z]/g, '')
}

function parseName(value?: string | null): ParsedName | null {
  const parts = (value || '')
    .split(/\s+/)
    .map(normalizeNamePart)
    .filter(Boolean)
    .filter((part) => !SUFFIXES.has(part))

  if (parts.length < 2) return null

  return {
    firstName: parts[0],
    lastName: parts[parts.length - 1],
    middleInitial: parts.length > 2 ? parts[1]?.charAt(0) : undefined,
  }
}

function getClientName(client: ClientName) {
  return [client.firstName, client.middleInitial, client.lastName]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(' ')
}

export function getReportClientMatch(donorName: string | null | undefined, client: ClientName): ReportClientMatch {
  const clientName = getClientName(client)
  const parsedReportName = parseName(donorName)
  const parsedClientName = parseName(clientName)

  if (!parsedReportName || !parsedClientName) {
    return {
      status: 'unknown',
      reportName: donorName || null,
      clientName,
    }
  }

  const score = calculateNameSimilarity(
    parsedReportName.firstName,
    parsedReportName.lastName,
    parsedClientName.firstName,
    parsedClientName.lastName,
    parsedReportName.middleInitial,
    parsedClientName.middleInitial,
  )

  return {
    status: score >= MATCH_THRESHOLD ? 'match' : 'mismatch',
    score,
    reportName: donorName || '',
    clientName,
  }
}
