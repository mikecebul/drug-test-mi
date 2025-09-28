import type { Medication } from '../types'

/**
 * Check if a medication is less than a week old and can be edited/deleted
 */
export function isMedicationEditable(medication: Medication): boolean {
  if (!medication.createdAt) {
    // If no createdAt, assume it's an old medication that can't be edited
    return false
  }

  const oneWeekInMs = 7 * 24 * 60 * 60 * 1000
  const createdAt = new Date(medication.createdAt).getTime()
  const now = new Date().getTime()

  return (now - createdAt) < oneWeekInMs
}

/**
 * Get how many days ago a medication was created
 */
export function getMedicationAge(medication: Medication): number | null {
  if (!medication.createdAt) return null

  const createdAt = new Date(medication.createdAt).getTime()
  const now = new Date().getTime()
  const diffInMs = now - createdAt
  const diffInDays = Math.floor(diffInMs / (24 * 60 * 60 * 1000))

  return diffInDays
}

/**
 * Get a human-readable age description for a medication
 */
export function getMedicationAgeDescription(medication: Medication): string {
  const age = getMedicationAge(medication)

  if (age === null) return 'Unknown'
  if (age === 0) return 'Added today'
  if (age === 1) return 'Added yesterday'
  if (age < 7) return `Added ${age} days ago`

  const weeks = Math.floor(age / 7)
  if (weeks === 1) return 'Added 1 week ago'
  if (weeks < 4) return `Added ${weeks} weeks ago`

  const months = Math.floor(age / 30)
  if (months === 1) return 'Added 1 month ago'

  return `Added ${months} months ago`
}