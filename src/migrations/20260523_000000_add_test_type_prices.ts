import { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-mongodb'

const TEST_TYPE_PRICES: Record<string, number> = {
  '11-panel-lab': 40,
  '11-panel-lab-no-etg': 40,
  '15-panel-instant': 35,
  '17-panel-instant': 35,
  '17-panel-sos-lab': 45,
  'etg-lab': 40,
}

export async function up({ payload, req }: MigrateUpArgs): Promise<void> {
  for (const [value, price] of Object.entries(TEST_TYPE_PRICES)) {
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
      data: { price },
      overrideAccess: true,
      req,
    })
  }

  payload.logger.info('Updated test type prices')
}

export async function down({ payload }: MigrateDownArgs): Promise<void> {
  payload.logger.info('Down migration for test type prices is a no-op')
}
