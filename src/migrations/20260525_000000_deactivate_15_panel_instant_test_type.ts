import { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-mongodb'

import { LEGACY_TEST_TYPES_COLLECTION } from '@/lib/legacy-test-types-collection'

const TEST_TYPE_VALUE = '15-panel-instant'

async function findTestType(payload: MigrateUpArgs['payload']) {
  return payload.find({
    collection: LEGACY_TEST_TYPES_COLLECTION,
    where: {
      value: {
        equals: TEST_TYPE_VALUE,
      },
    },
    depth: 0,
    limit: 1,
    overrideAccess: true,
  })
}

export async function up({ payload }: MigrateUpArgs): Promise<void> {
  const existing = await findTestType(payload)

  if (!existing.docs[0]) {
    payload.logger.info('15-panel instant test type not found; nothing to deactivate')
    return
  }

  await payload.update({
    collection: LEGACY_TEST_TYPES_COLLECTION,
    id: (existing.docs[0] as { id: string }).id,
    data: { isActive: false } as never,
    overrideAccess: true,
  })

  payload.logger.info('Deactivated 15-panel instant test type')
}

export async function down({ payload }: MigrateDownArgs): Promise<void> {
  const existing = await findTestType(payload)

  if (!existing.docs[0]) {
    payload.logger.info('15-panel instant test type not found; nothing to reactivate')
    return
  }

  await payload.update({
    collection: LEGACY_TEST_TYPES_COLLECTION,
    id: (existing.docs[0] as { id: string }).id,
    data: { isActive: true } as never,
    overrideAccess: true,
  })

  payload.logger.info('Reactivated 15-panel instant test type')
}
