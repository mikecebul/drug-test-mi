import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-mongodb'
import { buildClientSearchFields } from '@/collections/Clients/search/normalize'

export async function up({ payload, req }: MigrateUpArgs): Promise<void> {
  let page = 1
  let updated = 0

  while (true) {
    const result = await payload.find({
      collection: 'clients',
      depth: 0,
      limit: 200,
      page,
      sort: 'id',
      overrideAccess: true,
      req,
      select: {
        id: true,
        firstName: true,
        middleInitial: true,
        lastName: true,
        email: true,
        phone: true,
        dob: true,
      },
    })

    for (const client of result.docs) {
      await payload.update({
        collection: 'clients',
        id: client.id,
        data: buildClientSearchFields(client),
        depth: 0,
        overrideAccess: true,
        req,
      })
      updated += 1
    }

    if (!result.hasNextPage) break
    page = result.nextPage || page + 1
  }

  payload.logger.info(`Backfilled protected search fields for ${updated} client(s)`)
}

export async function down({ payload }: MigrateDownArgs): Promise<void> {
  payload.logger.info('Client search field rollback is a no-op; normalized values remain private and unused')
}
