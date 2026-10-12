import { calculateNameSimilarity, calculateSimilarity } from '@/views/DrugTestWizard/utils/calculateSimilarity'
import { formatDobInput } from '@/lib/date-utils'

type ClientName = {
  id?: string | null
  firstName?: string | null
  lastName?: string | null
  middleInitial?: string | null
  dob?: string | null
}

type ParsedName = {
  firstName: string
  lastName: string
  middleInitial?: string
}

export type ReportClientMatch = {
  status: 'match' | 'warning' | 'mismatch' | 'unknown'
  score?: number
  reportName: string | null
  clientName: string
  reportDob: string | null
  clientDob: string | null
  nameDifferent: boolean
  dobDifferent: boolean
  requiresConfirmation: boolean
  confirmationKey: string | null
}

export function getReportClientMismatchKey(match: ReportClientMatch | null | undefined) {
  return match?.confirmationKey ?? null
}

const MATCH_THRESHOLD = 0.9
const CLOSE_NAME_WARNING_THRESHOLD = 0.7
const CLOSE_FIRST_NAME_THRESHOLD = 0.8
const CLOSE_LAST_NAME_THRESHOLD = 0.65
const SUFFIXES = new Set(['jr', 'sr', 'ii', 'iii', 'iv', 'v'])

function normalizeNamePart(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}]/gu, '')
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

export function getReportClientMatch(
  donorName: string | null | undefined,
  client: ClientName,
  reportBirthDate?: string | null,
): ReportClientMatch {
  const clientName = getClientName(client)
  const parsedReportName = parseName(donorName)
  const parsedClientName = parseName(clientName)
  const reportDob = reportBirthDate?.trim() ? formatDobInput(reportBirthDate) || null : null
  const clientDob = formatDobInput(client.dob) || null
  // A missing report DOB is not evidence of a mismatch. An unreadable DOB that
  // is present, or a DOB that cannot be compared with the profile, needs review.
  const dobDifferent = Boolean(reportBirthDate?.trim()) && (!reportDob || !clientDob || reportDob !== clientDob)
  const nameDifferent =
    !parsedReportName || !parsedClientName || normalizeNamePart(donorName || '') !== normalizeNamePart(clientName)
  const requiresConfirmation = nameDifferent || dobDifferent
  const identity = {
    reportName: donorName?.trim() || null,
    clientName,
    reportDob,
    clientDob,
    nameDifferent,
    dobDifferent,
    requiresConfirmation,
    // Tie confirmation to the actual client and both identity fields. Edits or
    // a different same-name client must not inherit an earlier acknowledgement.
    confirmationKey: requiresConfirmation
      ? JSON.stringify([client.id ?? null, clientName, clientDob, donorName ?? null, reportBirthDate ?? null])
      : null,
  }

  if (!parsedReportName || !parsedClientName) {
    return {
      ...identity,
      status: 'unknown',
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
  const firstNameScore = calculateSimilarity(parsedReportName.firstName, parsedClientName.firstName)
  const lastNameScore = calculateSimilarity(parsedReportName.lastName, parsedClientName.lastName)
  const isCloseNameTypo =
    score >= CLOSE_NAME_WARNING_THRESHOLD &&
    firstNameScore >= CLOSE_FIRST_NAME_THRESHOLD &&
    lastNameScore >= CLOSE_LAST_NAME_THRESHOLD

  return {
    ...identity,
    status: !requiresConfirmation
      ? 'match'
      : dobDifferent
        ? 'mismatch'
        : score >= MATCH_THRESHOLD || isCloseNameTypo
          ? 'warning'
          : 'mismatch',
    score,
  }
}
