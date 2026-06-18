import { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-mongodb'

const TEST_TYPE_VALUE = '15-panel-instant'

async function findTestType(payload: MigrateUpArgs['payload']) {
  return payload.find({
    collection: 'test-types',
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
    collection: 'test-types',
    id: existing.docs[0].id,
    data: { isActive: false },
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
    collection: 'test-types',
    id: existing.docs[0].id,
    data: { isActive: true },
    overrideAccess: true,
  })

  payload.logger.info('Reactivated 15-panel instant test type')
}
