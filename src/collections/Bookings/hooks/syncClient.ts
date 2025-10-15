import { CollectionAfterChangeHook } from 'payload'

export const syncClient: CollectionAfterChangeHook = async ({ doc, req }) => {
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
      // Update existing client name if it changed
      const existingClient = existingClients.docs[0]
      clientId = existingClient.id

      await payload.update({
        collection: 'clients',
        id: existingClient.id,
        data: {
          name: doc.attendeeName,
          firstName: doc.attendeeName.split(' ')[0],
          lastName: doc.attendeeName.split(' ').slice(1).join(' '),
        },
      })

      req.payload.logger.info(`Updated client ${doc.attendeeEmail} from booking ${doc.id}`)
    } else {
      // Create new client
      const newClient = await payload.create({
        collection: 'clients',
        data: {
          name: doc.attendeeName,
          firstName: doc.attendeeName.split(' ')[0],
          lastName: doc.attendeeName.split(' ').slice(1).join(' '),
          email: doc.attendeeEmail,
          isActive: true,
        },
      })

      clientId = newClient.id
      req.payload.logger.info(`Created new client ${doc.attendeeEmail} from booking ${doc.id}`)
    }

    // Update the booking with the client relationship if not already set
    if (!doc.relatedClient || (typeof doc.relatedClient === 'object' && doc.relatedClient.id !== clientId) || (typeof doc.relatedClient === 'string' && doc.relatedClient !== clientId)) {
      await payload.update({
        collection: 'bookings',
        id: doc.id,
        data: {
          relatedClient: clientId,
        },
      })
      req.payload.logger.info(`Linked booking ${doc.id} to client ${clientId}`)
    }

  } catch (error) {
    // Log error but don't fail the booking creation
    req.payload.logger.error(`Failed to sync client for booking ${doc.id}: ${error}`)
  }

  return doc
}