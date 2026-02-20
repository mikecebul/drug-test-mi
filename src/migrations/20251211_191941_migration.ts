import {
  MigrateDownArgs,
  MigrateUpArgs,
} from '@payloadcms/db-mongodb'

const OLD_EMAIL = 'petersa@charlevoixcounty.org'
const OLD_NAME = 'Assignment Clerk'
const NEW_EMAIL = 'westonm@charlevoixcounty.org'
const NEW_NAME = 'Marla Weston'

export async function up({ payload }: MigrateUpArgs): Promise<void> {
  payload.logger.info('Starting migration: Update Assignment Clerk email to Marla Weston')

  // Fetch all clients
  const clients = await payload.find({
    collection: 'clients',
    limit: 1000, // Adjust if you have more than 1000 clients
    depth: 0,
  })

  let updatedCount = 0

  for (const client of clients.docs as any[]) {
    let needsUpdate = false
    const updates: any = {}

    // Check courtInfo recipients (probation/court clients)
    if (client.courtInfo?.recipients && Array.isArray(client.courtInfo.recipients)) {
      const updatedRecipients = client.courtInfo.recipients.map((recipient: any) => {
        if (recipient.email === OLD_EMAIL) {
          needsUpdate = true
          return { name: NEW_NAME, email: NEW_EMAIL }
        }
        return recipient
      })
      if (needsUpdate) {
        updates['courtInfo.recipients'] = updatedRecipients
      }
    }

    // Check employmentInfo recipients (employment clients)
    if (client.employmentInfo?.recipients && Array.isArray(client.employmentInfo.recipients)) {
      const updatedRecipients = client.employmentInfo.recipients.map((recipient: any) => {
        if (recipient.email === OLD_EMAIL) {
          needsUpdate = true
          return { name: NEW_NAME, email: NEW_EMAIL }
        }
        return recipient
      })
      if (needsUpdate) {
        updates['employmentInfo.recipients'] = updatedRecipients
      }
    }

    // Check selfInfo recipients (self-pay clients)
    if (client.selfInfo?.recipients && Array.isArray(client.selfInfo.recipients)) {
      const updatedRecipients = client.selfInfo.recipients.map((recipient: any) => {
        if (recipient.email === OLD_EMAIL) {
          needsUpdate = true
          return { name: NEW_NAME, email: NEW_EMAIL }
        }
        return recipient
      })
      if (needsUpdate) {
        updates['selfInfo.recipients'] = updatedRecipients
      }
    }

    // Update client if any recipients were changed
    if (needsUpdate) {
      await payload.update({
        collection: 'clients',
        id: client.id,
        data: updates,
      })
      updatedCount++
      payload.logger.info(`Updated client ${client.id} (${client.firstName} ${client.lastName})`)
    }
  }

  payload.logger.info(`Migration complete: Updated ${updatedCount} clients`)
}

export async function down({ payload }: MigrateDownArgs): Promise<void> {
  payload.logger.info('Starting rollback: Revert Marla Weston email to Assignment Clerk')

  // Fetch all clients
  const clients = await payload.find({
    collection: 'clients',
    limit: 1000,
    depth: 0,
  })

  let revertedCount = 0

  for (const client of clients.docs as any[]) {
    let needsUpdate = false
    const updates: any = {}

    // Check courtInfo recipients
    if (client.courtInfo?.recipients && Array.isArray(client.courtInfo.recipients)) {
      const updatedRecipients = client.courtInfo.recipients.map((recipient: any) => {
        if (recipient.email === NEW_EMAIL) {
          needsUpdate = true
          return { name: OLD_NAME, email: OLD_EMAIL }
        }
        return recipient
      })
      if (needsUpdate) {
        updates['courtInfo.recipients'] = updatedRecipients
      }
    }

    // Check employmentInfo recipients
    if (client.employmentInfo?.recipients && Array.isArray(client.employmentInfo.recipients)) {
      const updatedRecipients = client.employmentInfo.recipients.map((recipient: any) => {
        if (recipient.email === NEW_EMAIL) {
          needsUpdate = true
          return { name: OLD_NAME, email: OLD_EMAIL }
        }
        return recipient
      })
      if (needsUpdate) {
        updates['employmentInfo.recipients'] = updatedRecipients
      }
    }

    // Check selfInfo recipients
    if (client.selfInfo?.recipients && Array.isArray(client.selfInfo.recipients)) {
      const updatedRecipients = client.selfInfo.recipients.map((recipient: any) => {
        if (recipient.email === NEW_EMAIL) {
          needsUpdate = true
          return { name: OLD_NAME, email: OLD_EMAIL }
        }
        return recipient
      })
      if (needsUpdate) {
        updates['selfInfo.recipients'] = updatedRecipients
      }
    }

    // Update client if any recipients were changed
    if (needsUpdate) {
      await payload.update({
        collection: 'clients',
        id: client.id,
        data: updates,
      })
      revertedCount++
      payload.logger.info(`Reverted client ${client.id} (${client.firstName} ${client.lastName})`)
    }
  }

  payload.logger.info(`Rollback complete: Reverted ${revertedCount} clients`)
}
