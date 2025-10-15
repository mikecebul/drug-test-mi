import { CollectionBeforeChangeHook, CollectionAfterChangeHook } from 'payload'

// Helper to parse name into firstName and lastName
function parseName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(' ')
  const firstName = parts[0] || 'Unknown'
  const lastName = parts.slice(1).join(' ') || 'Unknown'
  return { firstName, lastName }
}

// Before change hook to set relatedClient and isPrepaid
export const setClientRelationship: CollectionBeforeChangeHook = async ({
  data,
  req,
}) => {
  // Only process if we have attendee information
  if (!data.attendeeName || !data.attendeeEmail) {
    return data
  }

  try {
    const { payload } = req

    // Check if client already exists
    const existingClients = await payload.find({
      collection: 'clients',
      where: {
        email: {
          equals: data.attendeeEmail,
        },
      },
      limit: 1,
    })

    if (existingClients.docs.length > 0) {
      // Set the client relationship
      data.relatedClient = existingClients.docs[0].id
    }

  } catch (error) {
    req.payload.logger.error(`Failed to set client relationship: ${error}`)
  }

  return data
}

// After change hook to sync client stats
export const syncClient: CollectionAfterChangeHook = async ({
  doc,
  req,
}) => {
  // Only sync if we have attendee information
  if (!doc.attendeeName || !doc.attendeeEmail) {
    return doc
  }

  try {
    const { payload } = req

    // Check if client already exists
    const existingClients = await payload.find({
      collection: 'clients',
      where: {
        email: {
          equals: doc.attendeeEmail,
        },
      },
      limit: 1,
    })

    const { firstName, lastName } = parseName(doc.attendeeName)

    if (existingClients.docs.length > 0) {
      // Update existing client stats only (don't update name - email is the unique identifier)
      const existingClient = existingClients.docs[0]

      // Get all bookings for this client to calculate stats
      const allBookings = await payload.find({
        collection: 'bookings',
        where: {
          attendeeEmail: {
            equals: doc.attendeeEmail,
          },
        },
        sort: '-startTime',
      })

      const totalBookings = allBookings.docs.length
      const lastBookingDate = allBookings.docs[0]?.startTime
      const firstBookingDate = allBookings.docs[totalBookings - 1]?.startTime

      await payload.update({
        collection: 'clients',
        id: existingClient.id,
        data: {
          totalBookings,
          lastBookingDate,
          firstBookingDate,
        },
      })
    } else {
      // Don't auto-create clients - they need to register themselves
      // This booking will remain unlinked until the client registers
      req.payload.logger.info(`Booking ${doc.id} created for unregistered email ${doc.attendeeEmail}. Client needs to register.`)
      return doc
    }

    // Log the sync for debugging
    req.payload.logger.info(`Synced client ${doc.attendeeEmail} with booking ${doc.id}`)

  } catch (error) {
    // Log error but don't fail the booking creation
    req.payload.logger.error(`Failed to sync client for booking ${doc.id}: ${error}`)
  }

  return doc
}