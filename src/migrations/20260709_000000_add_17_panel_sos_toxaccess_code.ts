import { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-mongodb'

const TEST_TYPE_VALUE = '17-panel-sos-lab'
const TOXACCESS_CODE = 'B306'

export async function up({ payload, req }: MigrateUpArgs): Promise<void> {
  const existing = await payload.find({
    collection: 'test-types',
    where: {
      value: {
        equals: TEST_TYPE_VALUE,
      },
    },
    depth: 0,
    limit: 1,
    overrideAccess: true,
    req,
  })

  if (!existing.docs[0]) {
    payload.logger.info('17-panel SOS lab test type not found; no ToxAccess code updated')
    return
  }

  await payload.update({
    collection: 'test-types',
    id: existing.docs[0].id,
    data: { toxAccessCode: TOXACCESS_CODE },
    overrideAccess: true,
    req,
  })

  payload.logger.info('Updated 17-panel SOS lab ToxAccess code')
}

export async function down({ payload }: MigrateDownArgs): Promise<void> {
  payload.logger.info('Down migration for 17-panel SOS lab ToxAccess code is a no-op')
}
