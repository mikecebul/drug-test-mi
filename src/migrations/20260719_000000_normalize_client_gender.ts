import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-mongodb'

export async function up({ payload, req }: MigrateUpArgs): Promise<void> {
  let updated = 0

  while (true) {
    const clients = await payload.find({
      collection: 'clients',
      depth: 0,
      limit: 200,
      page: 1,
      overrideAccess: true,
      req,
      where: {
        gender: {
          equals: 'other',
        },
      },
    })

    if (clients.docs.length === 0) break

    for (const client of clients.docs) {
      await payload.update({
        collection: 'clients',
        id: client.id,
        data: { gender: 'prefer-not-to-say' },
        depth: 0,
        overrideAccess: true,
        req,
      })
      updated += 1
    }
  }

  payload.logger.info(`Normalized gender for ${updated} existing client(s)`)
}

export async function down({ payload }: MigrateDownArgs): Promise<void> {
  payload.logger.info('Client gender rollback is a no-op because the original values are intentionally consolidated')
}
