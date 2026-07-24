import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-mongodb'

export const ISAAC_CLIENT_ID = '6a6143224ee858c8e80698fc'

export async function up({ payload, session }: MigrateUpArgs): Promise<void> {
  const result = await payload.db.collections.clients.collection.updateOne(
    {
      $expr: {
        $eq: [{ $toString: '$_id' }, ISAAC_CLIENT_ID],
      },
      redwoodMatchedBy: 'unique-id',
    },
    {
      $unset: {
        redwoodMatchedBy: '',
      },
    },
    { session },
  )

  payload.logger.info(
    result.modifiedCount === 1
      ? `Removed obsolete ToxAccess match metadata from Isaac client ${ISAAC_CLIENT_ID}`
      : `Isaac client ${ISAAC_CLIENT_ID} had no obsolete ToxAccess match metadata; cleanup skipped`,
  )
}

export async function down({ payload }: MigrateDownArgs): Promise<void> {
  payload.logger.info(`Isaac client ${ISAAC_CLIENT_ID} legacy ToxAccess match cleanup is intentionally not reversible`)
}
