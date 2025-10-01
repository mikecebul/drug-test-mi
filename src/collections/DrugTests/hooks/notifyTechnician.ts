import type { CollectionAfterChangeHook } from 'payload'

/**
 * Sends email notification to the assigned technician about a drug test
 */
async function sendTechnicianNotification(
  drugTest: any,
  technician: any,
  payload: any,
): Promise<void> {
  try {
    const client =
      typeof drugTest.relatedClient === 'object'
        ? drugTest.relatedClient
        : await payload.findByID({
            collection: 'clients',
            id: drugTest.relatedClient,
            depth: 0,
          })

    const collectionDate = new Date(drugTest.collectionDate).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })

    const emailHtml = `
      <h2>Drug Test Assignment</h2>
      <p>Hi ${technician.name},</p>
      <p>You have been assigned to observe a drug test:</p>
      <ul>
        <li><strong>Client:</strong> ${client.firstName} ${client.lastName}</li>
        <li><strong>Date:</strong> ${collectionDate}</li>
        <li><strong>Time:</strong> ${drugTest.collectionTime || 'Not specified'}</li>
        <li><strong>Test Type:</strong> ${drugTest.testType || 'Not specified'}</li>
      </ul>
      <p>Please confirm your availability or contact the office if you need coverage.</p>
      <p>Thank you,<br/>MI Drug Test</p>
    `

    await payload.sendEmail({
      to: technician.email,
      subject: `Drug Test Assignment - ${collectionDate}`,
      html: emailHtml,
    })

    payload.logger.info(`Notification sent to technician ${technician.name} (${technician.email})`)
  } catch (error) {
    payload.logger.error('Error sending technician notification:', error)
    throw error
  }
}

/**
 * Notifies the technician when:
 * 1. A new test is created with a technician assigned
 * 2. The collection date or time changes
 * 3. The technician assignment changes
 */
export const notifyTechnician: CollectionAfterChangeHook = async ({
  doc,
  operation,
  previousDoc,
  req,
}) => {
  // Determine if we should send notification
  const shouldNotify =
    operation === 'create' ||
    (previousDoc &&
      (doc.collectionDate !== previousDoc.collectionDate ||
        doc.collectionTime !== previousDoc.collectionTime ||
        doc.technician !== previousDoc.technician))

  if (shouldNotify && doc.technician) {
    try {
      // Get technician details
      const technician =
        typeof doc.technician === 'object'
          ? doc.technician
          : await req.payload.findByID({
              collection: 'technicians',
              id: doc.technician,
              depth: 0,
            })

      // Send notification
      await sendTechnicianNotification(doc, technician, req.payload)

      // Update the notifiedTechnician field
      // Use overrideAccess to bypass access controls for this system operation
      await req.payload.update({
        collection: 'drug-tests',
        id: doc.id,
        data: {
          notifiedTechnician: technician.id,
        },
        overrideAccess: true,
      })
    } catch (error) {
      req.payload.logger.error('Error in notifyTechnician hook:', error)
      // Don't throw - we don't want to block the drug test creation/update
    }
  }
}
