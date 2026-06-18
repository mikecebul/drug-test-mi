import { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-mongodb'

const TOXACCESS_TEST_CODES: Record<string, string> = {
  '11-panel-lab': 'B729',
  '11-panel-lab-no-etg': 'B829',
}

export async function up({ payload, req }: MigrateUpArgs): Promise<void> {
  for (const [value, toxAccessCode] of Object.entries(TOXACCESS_TEST_CODES)) {
    const existing = await payload.find({
      collection: 'test-types',
      where: {
        value: {
          equals: value,
        },
      },
      depth: 0,
      limit: 1,
      overrideAccess: true,
      req,
    })

    if (!existing.docs[0]) continue

    await payload.update({
      collection: 'test-types',
      id: existing.docs[0].id,
      data: { toxAccessCode },
      overrideAccess: true,
      req,
    })
  }

  payload.logger.info('Updated ToxAccess test codes')
}

export async function down({ payload }: MigrateDownArgs): Promise<void> {
  payload.logger.info('Down migration for ToxAccess test codes is a no-op')
}
