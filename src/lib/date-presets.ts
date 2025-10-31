/**
 * Date range preset utilities
 *
 * Provides consistent date range calculations for filtering and date pickers.
 */

import { type DateRange } from 'react-day-picker'

/**
 * Get a date range for the last N days
 *
 * @param days - Number of days to go back from today
 * @returns DateRange object with from and to dates
 *
 * @example
 * getLastNDays(7) // Last 7 days from today
 * getLastNDays(30) // Last 30 days from today
 */
export function getLastNDays(days: number): DateRange {
  const today = new Date()
  const startDate = new Date(today.getTime() - days * 24 * 60 * 60 * 1000)

  return {
    from: startDate,
    to: today,
  }
}

/**
 * Preset date ranges for common filtering scenarios
 */
export const DATE_PRESETS = {
  last7Days: () => getLastNDays(7),
  last30Days: () => getLastNDays(30),
  last6Months: () => getLastNDays(180), // Approximate 6 months
  last90Days: () => getLastNDays(90),
  last365Days: () => getLastNDays(365),
} as const

/**
 * Get a date range for the last N months (approximate)
 *
 * @param months - Number of months to go back from today
 * @returns DateRange object with from and to dates
 *
 * Note: Uses 30-day approximation for months. For precise month calculations,
 * consider using date-fns or similar library.
 */
export function getLastNMonths(months: number): DateRange {
  const today = new Date()
  const startDate = new Date(today.getTime() - months * 30 * 24 * 60 * 60 * 1000)

  return {
    from: startDate,
    to: today,
  }
}

/**
 * Common date preset configurations for UI
 *
 * Each preset includes a label, value, and date range generator.
 */
export const DATE_PRESET_CONFIGS = [
  {
    label: 'Last 7 days',
    value: 'last7days',
    getRange: DATE_PRESETS.last7Days,
  },
  {
    label: 'Last 30 days',
    value: 'last30days',
    getRange: DATE_PRESETS.last30Days,
  },
  {
    label: 'Last 6 months',
    value: 'last6months',
    getRange: DATE_PRESETS.last6Months,
  },
] as const
