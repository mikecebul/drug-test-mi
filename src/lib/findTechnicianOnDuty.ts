import type { Payload } from 'payload'
import type { Technician } from '@/payload-types'

/**
 * Determines the time slot based on the time and day
 */
function determineTimeSlot(time: string, dayOfWeek: string): string {
  // Special case for Fixed Saturday
  if (dayOfWeek === 'saturday' && time === '11:10 AM') {
    return 'late-morning'
  }

  // Parse time to determine general time slot
  const hour = parseInt(time.split(':')[0])
  const isPM = time.toLowerCase().includes('pm')
  const hour24 = isPM && hour !== 12 ? hour + 12 : hour

  if (hour24 >= 8 && hour24 < 10) {
    return 'morning'
  } else if (hour24 >= 10 && hour24 < 12) {
    return 'late-morning'
  } else if (hour24 >= 12 && hour24 < 17) {
    return 'afternoon'
  }

  // Default to morning if unable to determine
  return 'morning'
}

/**
 * Finds the technician on duty for a given date and time
 *
 * Priority:
 * 1. Check for schedule overrides
 * 2. Fall back to regular schedule
 *
 * @param date - The date to check
 * @param time - The time to check (e.g., "11:10 AM")
 * @param payload - Payload instance
 * @returns The technician on duty, or null if none found
 */
export async function findTechnicianOnDuty(
  date: Date,
  time: string,
  payload: Payload,
): Promise<Technician | null> {
  // Get day of week in lowercase
  const dayOfWeek = date
    .toLocaleDateString('en-US', { weekday: 'long' })
    .toLowerCase() as
    | 'monday'
    | 'tuesday'
    | 'wednesday'
    | 'thursday'
    | 'friday'
    | 'saturday'
    | 'sunday'

  const timeSlot = determineTimeSlot(time, dayOfWeek)
  const dateString = date.toISOString().split('T')[0] // YYYY-MM-DD format

  // 1. Check for schedule overrides first
  try {
    const overrideResult = await payload.find({
      collection: 'schedule-overrides',
      where: {
        and: [
          {
            date: {
              equals: dateString,
            },
          },
          {
            timeSlot: {
              equals: timeSlot,
            },
          },
        ],
      },
      limit: 1,
    })

    if (overrideResult.docs.length > 0) {
      const override = overrideResult.docs[0]
      // Return the covering technician from the override
      if (typeof override.coveringTechnician === 'object' && override.coveringTechnician !== null) {
        return override.coveringTechnician as Technician
      }
    }
  } catch (error) {
    console.error('Error checking schedule overrides:', error)
  }

  // 2. Fall back to regular schedule
  try {
    const technicianResult = await payload.find({
      collection: 'technicians',
      where: {
        and: [
          {
            isActive: {
              equals: true,
            },
          },
          {
            'regularSchedule.dayOfWeek': {
              equals: dayOfWeek,
            },
          },
          {
            'regularSchedule.timeSlot': {
              equals: timeSlot,
            },
          },
          {
            'regularSchedule.isActive': {
              equals: true,
            },
          },
        ],
      },
      limit: 1,
    })

    if (technicianResult.docs.length > 0) {
      return technicianResult.docs[0]
    }
  } catch (error) {
    console.error('Error finding technician from regular schedule:', error)
  }

  // No technician found
  return null
}
