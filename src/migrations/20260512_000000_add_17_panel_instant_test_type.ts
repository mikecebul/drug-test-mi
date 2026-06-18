import { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-mongodb'

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
    collection: 'test-types',
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
      collection: 'test-types',
      id: existing.docs[0].id,
      data: TEST_TYPE,
      overrideAccess: true,
      req,
    })

    payload.logger.info('Updated 17-panel instant test type')
    return
  }

  await payload.create({
    collection: 'test-types',
    data: TEST_TYPE,
    overrideAccess: true,
    req,
  })

  payload.logger.info('Created 17-panel instant test type')
}

export async function down({ payload }: MigrateDownArgs): Promise<void> {
  payload.logger.info('Down migration for 17-panel instant test type is a no-op')
}
