import {
  MigrateDownArgs,
  MigrateUpArgs,
} from '@payloadcms/db-mongodb'

export async function up({ payload, req }: MigrateUpArgs): Promise<void> {
  payload.logger.info('Starting migration: backfill client referralAdditionalRecipients')

  const normalizeRecipientRows = (
    rows: Array<{ name?: string | null; email?: string | null }> | undefined,
  ): Array<{ name?: string; email: string }> => {
    const deduped = new Map<string, { name?: string; email: string }>()

    for (const row of rows || []) {
      const email = typeof row?.email === 'string' ? row.email.trim() : ''
      if (!email) continue

      const key = email.toLowerCase()
      const name = typeof row?.name === 'string' ? row.name.trim() || undefined : undefined
      const existing = deduped.get(key)

      if (!existing) {
        deduped.set(key, { ...(name ? { name } : {}), email })
        continue
      }

      if (!existing.name && name) {
        deduped.set(key, { name, email: existing.email })
      }
    }

    return Array.from(deduped.values())
  }

  let page = 1
  let updated = 0
  let skipped = 0

  while (true) {
    const result = await payload.find({
      collection: 'clients',
      limit: 200,
      page,
      depth: 0,
      overrideAccess: true,
      req,
    })

    for (const client of result.docs as any[]) {
      if (client?.referralType !== 'self') {
        skipped++
        continue
      }

      const legacyRecipients = normalizeRecipientRows(client?.selfReferral?.recipients)
      if (legacyRecipients.length === 0) {
        skipped++
        continue
      }

      const currentRecipients = normalizeRecipientRows(client?.referralAdditionalRecipients)
      const mergedRecipients = normalizeRecipientRows([...currentRecipients, ...legacyRecipients])

      const isSameLength = mergedRecipients.length === currentRecipients.length
      const isSame =
        isSameLength &&
        mergedRecipients.every((row, index) => {
          const current = currentRecipients[index]
          return current?.email === row.email && (current?.name || '') === (row.name || '')
        })

      if (isSame) {
        skipped++
        continue
      }

      await payload.update({
        collection: 'clients',
        id: client.id,
        data: {
          referralAdditionalRecipients: mergedRecipients,
        },
        overrideAccess: true,
        req,
      })

      updated++
    }

    if (!result.hasNextPage) break
    page += 1
  }

  payload.logger.info(
    `Client referralAdditionalRecipients migration complete. Updated: ${updated}, Skipped: ${skipped}`,
  )
}

export async function down({ payload }: MigrateDownArgs): Promise<void> {
  payload.logger.info('Down migration for referralAdditionalRecipients backfill is a no-op')
}
