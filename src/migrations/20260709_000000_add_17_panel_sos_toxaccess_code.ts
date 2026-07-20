import { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-mongodb'

import { LEGACY_TEST_TYPES_COLLECTION } from '@/lib/legacy-test-types-collection'

const TEST_TYPE_VALUE = '17-panel-sos-lab'
const TOXACCESS_CODE = 'B306'

export async function up({ payload, req }: MigrateUpArgs): Promise<void> {
  const existing = await payload.find({
    collection: LEGACY_TEST_TYPES_COLLECTION,
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
    collection: LEGACY_TEST_TYPES_COLLECTION,
    id: (existing.docs[0] as { id: string }).id,
    data: { toxAccessCode: TOXACCESS_CODE } as never,
    overrideAccess: true,
    req,
  })

  payload.logger.info('Updated 17-panel SOS lab ToxAccess code')
}

export async function down({ payload }: MigrateDownArgs): Promise<void> {
  payload.logger.info('Down migration for 17-panel SOS lab ToxAccess code is a no-op')
}
