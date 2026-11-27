import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-mongodb'

const activeCheckoutIndex = 'unique_active_checkout_test'

export async function up({ payload }: MigrateUpArgs): Promise<void> {
  const payments = payload.db.collections.payments
  await payments.createCollection()
  await payments.collection.createIndex(
    { activeCheckoutTestIds: 1 },
    {
      name: activeCheckoutIndex,
      unique: true,
      partialFilterExpression: { activeCheckoutTestIds: { $type: 'string' } },
    },
  )
  await payments.collection.createIndex({ 'bundledCheckout.requestId': 1 }, { unique: true, sparse: true })
}

export async function down({ payload }: MigrateDownArgs): Promise<void> {
  await payload.db.collections.payments.collection.dropIndex(activeCheckoutIndex)
}
