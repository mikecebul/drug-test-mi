import type { CollectionAfterChangeHook } from 'payload'
import { phoneNumbersMatch } from '@/lib/calcom'

/**
 * After a booking is created/updated, sync the phone number with the related client
 * If the phone number has changed, update the client and add the old number to history
 */
export const syncPhoneWithClient: CollectionAfterChangeHook = async ({ doc, req, operation }) => {
  // Only process if created via webhook and has a phone number
  if (!doc.createdViaWebhook || !doc.phone || !doc.relatedClient) {
    return doc
  }

  // Skip if not created (only on update)
  if (operation === 'create') {
    // For new bookings, the client relationship hasn't been set yet
    // The setClientRelationship hook will run first
    return doc
  }

  try {
    const payload = req.payload

    // Get the related client
    const clientId = typeof doc.relatedClient === 'object' ? doc.relatedClient.id : doc.relatedClient

    if (!clientId) {
      return doc
    }

    const client = await payload.findByID({
      collection: 'clients',
      id: clientId,
    })

    if (!client) {
      console.warn(`Client ${clientId} not found for phone sync`)
      return doc
    }

    // Check if phone number needs to be updated
    const clientPhone = client.phone
    const bookingPhone = doc.phone

    if (!clientPhone || !phoneNumbersMatch(clientPhone, bookingPhone)) {
      // Phone number has changed or doesn't exist
      const updateData: any = {
        phone: bookingPhone,
      }

      // If client had a phone number, add it to history
      if (clientPhone && !phoneNumbersMatch(clientPhone, bookingPhone)) {
        const phoneHistory = client.phoneHistory || []
        updateData.phoneHistory = [
          ...phoneHistory,
          {
            number: clientPhone,
            changedAt: new Date().toISOString(),
          },
        ]

        console.log(`📱 Updated phone for client ${client.email}: ${clientPhone} → ${bookingPhone}`)
      } else {
        console.log(`📱 Set initial phone for client ${client.email}: ${bookingPhone}`)
      }

      // Update the client
      await payload.update({
        collection: 'clients',
        id: clientId,
        data: updateData,
        req,
      })
    }
  } catch (error) {
    // Log error but don't fail the booking creation
    console.error('Error syncing phone with client:', error)
  }

  return doc
}
