/**
 * Date formatting utilities for drug test application
 *
 * All drug test collection times are displayed in America/New_York (EST/EDT)
 * regardless of server location or user browser timezone. This ensures consistency
 * with PDF timestamps and legal documentation.
 */

import { format, parse } from 'date-fns'
import { TZDate } from '@date-fns/tz'

/**
 * Application timezone - all drug test times are in EST/EDT
 */
export const APP_TIMEZONE = 'America/New_York'

const MIN_DOB_YEAR = 1900

function createLocalDate(year: number, month: number, day: number): Date | null {
  const date = new Date(year, month - 1, day)

  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null
  }

  return date
}

/**
 * Expands a two-digit year using a DOB-specific century cutoff.
 * Years through the current two-digit year are treated as 20xx;
 * later values are treated as 19xx.
 */
function expandTwoDigitDobYear(year: number, referenceDate: Date): number {
  const currentTwoDigitYear = referenceDate.getFullYear() % 100
  return year <= currentTwoDigitYear ? 2000 + year : 1900 + year
}

/**
 * Parse the date formats accepted by the DOB field and client search.
 * Date-only strings are built in local time so stored ISO dates do not shift
 * by a day when formatted in a negative UTC offset.
 */
export function parseDob(value: string | Date | null | undefined, referenceDate: Date = new Date()): Date | null {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null

    const date = createLocalDate(value.getFullYear(), value.getMonth() + 1, value.getDate())
    if (!date) return null

    const year = date.getFullYear()
    return year >= MIN_DOB_YEAR && year <= referenceDate.getFullYear() ? date : null
  }

  const trimmed = value?.trim()
  if (!trimmed) return null

  let year: number
  let month: number
  let day: number

  const yearFirstMatch = trimmed.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})(?:T.*)?$/)
  const monthFirstMatch = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})$/)
  const compactMatch = trimmed.match(/^(\d{2})(\d{2})(\d{2}|\d{4})$/)

  if (yearFirstMatch) {
    year = Number(yearFirstMatch[1])
    month = Number(yearFirstMatch[2])
    day = Number(yearFirstMatch[3])
  } else if (monthFirstMatch || compactMatch) {
    const match = monthFirstMatch || compactMatch
    if (!match) return null

    month = Number(match[1])
    day = Number(match[2])
    const parsedYear = Number(match[3])
    year = match[3].length === 2 ? expandTwoDigitDobYear(parsedYear, referenceDate) : parsedYear
  } else {
    return null
  }

  if (year < MIN_DOB_YEAR || year > referenceDate.getFullYear()) return null
  return createLocalDate(year, month, day)
}

/** Format an accepted DOB value for fields and display (MM/DD/YYYY). */
export function formatDobInput(value: string | Date | null | undefined, referenceDate: Date = new Date()): string {
  const date = parseDob(value, referenceDate)
  if (!date) return ''

  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${month}/${day}/${date.getFullYear()}`
}

/** Normalize an accepted DOB value for storage and exact search (YYYY-MM-DD). */
export function formatDobISO(value: string | Date | null | undefined, referenceDate: Date = new Date()): string {
  const date = parseDob(value, referenceDate)
  if (!date) return ''

  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

/**
 * Get the UTC instants that bound a calendar day in the app timezone.
 *
 * Use this for database range queries against timestamp fields when the product
 * language says "today" or another local calendar day.
 */
export function getAppTimezoneDayWindow(date: Date = new Date()): { start: Date; end: Date } {
  const appDate = TZDate.tz(APP_TIMEZONE, date)
  const startInAppTimezone = new TZDate(
    appDate.getFullYear(),
    appDate.getMonth(),
    appDate.getDate(),
    0,
    0,
    0,
    0,
    APP_TIMEZONE,
  )
  const endInAppTimezone = new TZDate(
    appDate.getFullYear(),
    appDate.getMonth(),
    appDate.getDate() + 1,
    0,
    0,
    0,
    0,
    APP_TIMEZONE,
  )

  return {
    start: new Date(startInAppTimezone.getTime()),
    end: new Date(endInAppTimezone.getTime()),
  }
}

/**
 * Format a drug test collection date for display
 * Always shows EST/EDT time regardless of where code runs
 *
 * @param dateString - ISO date string in UTC (from database)
 * @returns Formatted string like "December 10, 2025, 3:45 PM EST"
 *
 * @example
 * ```ts
 * formatCollectionDate("2025-12-10T20:45:00.000Z")
 * // Returns: "December 10, 2025, 3:45 PM EST"
 * ```
 */
export function formatCollectionDate(dateString: string | Date): string {
  // Convert to Date if string, then create TZDate for EST/EDT interpretation
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString
  const tzDate = TZDate.tz(APP_TIMEZONE, date)
  return format(tzDate, 'MMMM d, yyyy, h:mm a') + ' EST'
}

/**
 * Format collection date in short format for tables
 *
 * @param dateString - ISO date string in UTC
 * @returns Short formatted string like "12/10/25"
 *
 * @example
 * ```ts
 * formatCollectionDateShort("2025-12-10T20:45:00.000Z")
 * // Returns: "12/10/25"
 * ```
 */
export function formatCollectionDateShort(dateString: string | Date): string {
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString
  const tzDate = TZDate.tz(APP_TIMEZONE, date)
  return format(tzDate, 'MM/dd/yy')
}

/**
 * Format date-only fields (DOB, medication dates, etc.)
 * NO timezone conversion - these are calendar dates, not specific moments in time
 *
 * Use this for: Date of birth, medication start/end dates, event dates
 * DON'T use this for: Collection times, appointment times (use formatCollectionDate instead)
 *
 * @param dateString - ISO date string or date object (date-only, no time)
 * @returns Formatted date like "12/10/1990"
 */
export function formatDateOnly(dateString: string | Date): string {
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString
  return format(date, 'MM/dd/yyyy')
}

/**
 * Format date-only values for storage (YYYY-MM-DD)
 * Uses local calendar date (no timezone conversion)
 */
export function formatDateOnlyISO(dateString: string | Date): string {
  if (typeof dateString === 'string') {
    const trimmed = dateString.trim()
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return trimmed
    }
    if (/^\d{1,2}[\/-]\d{1,2}[\/-]\d{4}$/.test(trimmed)) {
      const normalized = trimmed.replace(/-/g, '/')
      const parsed = parse(normalized, 'MM/dd/yyyy', new Date())
      if (!Number.isNaN(parsed.getTime())) {
        return format(parsed, 'yyyy-MM-dd')
      }
    }
    const parsed = new Date(trimmed)
    if (Number.isNaN(parsed.getTime())) {
      return trimmed
    }
    return format(parsed, 'yyyy-MM-dd')
  }
  return format(dateString, 'yyyy-MM-dd')
}

/**
 * Get today's date for date-only fields (YYYY-MM-DD)
 */
export function getTodayDateOnlyISO(): string {
  return format(new Date(), 'yyyy-MM-dd')
}

/**
 * Get current timestamp (ISO)
 */
export function getCurrentIsoTimestamp(): string {
  return new Date().toISOString()
}

/**
 * @deprecated Use formatDobInput instead (more descriptive name)
 */
export function formatDob(dateString: string | Date): string {
  return formatDobInput(dateString)
}
