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
 * @deprecated Use formatDateOnly instead (more descriptive name)
 */
export function formatDob(dateString: string | Date): string {
  return formatDateOnly(dateString)
}
