import { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-mongodb'

import { LEGACY_TEST_TYPES_COLLECTION } from '@/lib/legacy-test-types-collection'

const TEST_TYPE = {
  value: '17-panel-instant',
  label: '17-Panel Instant',
  bookingLabel: '17 Panel Instant',
  category: 'instant' as const,
  price: 35,
  isActive: true,
}

export async function up({ payload, req }: MigrateUpArgs): Promise<void> {
  const existing = await payload.find({
    collection: LEGACY_TEST_TYPES_COLLECTION,
    where: {
      value: {
        equals: TEST_TYPE.value,
      },
    },
    depth: 0,
    limit: 1,
    overrideAccess: true,
    req,
  })

  if (existing.docs[0]) {
    await payload.update({
      collection: LEGACY_TEST_TYPES_COLLECTION,
      id: (existing.docs[0] as { id: string }).id,
      data: TEST_TYPE as never,
      overrideAccess: true,
      req,
    })

    payload.logger.info('Updated 17-panel instant test type')
    return
  }

  await payload.create({
    collection: LEGACY_TEST_TYPES_COLLECTION,
    data: TEST_TYPE as never,
    overrideAccess: true,
    req,
  })

  payload.logger.info('Created 17-panel instant test type')
}

export async function down({ payload }: MigrateDownArgs): Promise<void> {
  payload.logger.info('Down migration for 17-panel instant test type is a no-op')
}
