import { CollectionAfterChangeHook } from 'payload'

export const syncClient: CollectionAfterChangeHook = async ({
  doc,
  operation,
  req,
  previousDoc,
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

    let clientId: string

    if (existingClients.docs.length > 0) {
      // Update existing client
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
          name: doc.attendeeName,// Update name in case it changed
          firstName: doc.attendeeName.split(' ')[0],
          lastName: doc.attendeeName.split(' ').slice(1).join(' '),
          totalBookings,
          lastBookingDate,
          firstBookingDate,
        },
      })

      clientId = existingClient.id
    } else {
      // Create new client
      const newClient = await payload.create({
        collection: 'clients',
        data: {
          name: doc.attendeeName,
          firstName: doc.attendeeName.split(' ')[0],
          lastName: doc.attendeeName.split(' ').slice(1).join(' '),
          email: doc.attendeeEmail,
          totalBookings: 1,
          lastBookingDate: doc.startTime,
          firstBookingDate: doc.startTime,
          isActive: true,
        },
      })

      clientId = newClient.id
    }

    // Log the sync for debugging
    req.payload.logger.info(`Synced client ${doc.attendeeEmail} with booking ${doc.id}`)

  } catch (error) {
    // Log error but don't fail the booking creation
    req.payload.logger.error(`Failed to sync client for booking ${doc.id}: ${error}`)
  }

  return doc
}