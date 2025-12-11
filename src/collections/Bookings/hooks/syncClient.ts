import { CollectionAfterChangeHook } from 'payload'
import { createAdminAlert } from '@/lib/admin-alerts'

export const syncClient: CollectionAfterChangeHook = async ({ doc, req }) => {
  // Only sync if we have attendee email
  if (!doc.attendeeEmail) {
    return doc
  }

  try {
    const { payload } = req

    // Check if client already exists by email
    const existingClients = await payload.find({
      collection: 'clients',
      where: {
        email: {
          equals: doc.attendeeEmail,
        },
      },
      limit: 1,
    })

    // Only link to existing client, never create or update
    if (existingClients.docs.length > 0) {
      const existingClient = existingClients.docs[0]
      const clientId = existingClient.id

      // Update the booking with the client relationship if not already set
      if (!doc.relatedClient || (typeof doc.relatedClient === 'object' && doc.relatedClient.id !== clientId) || (typeof doc.relatedClient === 'string' && doc.relatedClient !== clientId)) {
        await payload.update({
          collection: 'bookings',
          id: doc.id,
          data: {
            relatedClient: clientId,
          },
        })
        req.payload.logger.info(`Linked booking ${doc.id} to existing client ${clientId}`)
      }
    } else {
      req.payload.logger.info(`No existing client found for booking ${doc.id} with email ${doc.attendeeEmail}`)

      // Create admin alert for unlinked booking
      await createAdminAlert(payload, {
        severity: 'medium',
        alertType: 'data-integrity',
        title: `Booking created without client: ${doc.attendeeName}`,
        message: `A booking was created for ${doc.attendeeName} (${doc.attendeeEmail}) but no matching client exists in the system. Please create a client profile to link this booking.`,
        context: {
          bookingId: doc.id,
          attendeeName: doc.attendeeName,
          attendeeEmail: doc.attendeeEmail,
          startTime: doc.startTime,
          calcomBookingId: doc.calcomBookingId,
        },
      })
    }

  } catch (error) {
    // Log error but don't fail the booking creation
    req.payload.logger.error(`Failed to sync client for booking ${doc.id}: ${error}`)
  }

  return doc
}