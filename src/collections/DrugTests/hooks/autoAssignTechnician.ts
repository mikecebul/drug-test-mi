import type { CollectionBeforeChangeHook } from 'payload'
import { findTechnicianOnDuty } from '@/lib/findTechnicianOnDuty'

/**
 * Auto-assigns a technician to a drug test based on the collection date and time
 * Only runs on create or when date/time changes
 */
export const autoAssignTechnician: CollectionBeforeChangeHook = async ({
  data,
  operation,
  req,
}) => {
  // Only auto-assign if technician is not already set
  if (operation === 'create' && !data.technician) {
    // Need both date and time to auto-assign
    if (data.collectionDate && data.collectionTime) {
      try {
        const collectionDate = new Date(data.collectionDate)
        const technician = await findTechnicianOnDuty(
          collectionDate,
          data.collectionTime,
          req.payload,
        )

        if (technician) {
          data.technician = technician.id
          req.payload.logger.info(`Auto-assigned technician ${technician.name} to drug test`)
        } else {
          req.payload.logger.warn(
            `No technician found on duty for ${collectionDate.toDateString()} at ${data.collectionTime}`,
          )
        }
      } catch (error) {
        req.payload.logger.error('Error auto-assigning technician:', error)
      }
    }
  }

  return data
}
