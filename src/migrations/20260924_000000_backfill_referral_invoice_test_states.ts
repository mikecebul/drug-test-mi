import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-mongodb'

/** Link already sent invoices to their tests without changing amounts owed. */
export async function up({ payload, session }: MigrateUpArgs): Promise<void> {
  const invoices = payload.db.collections['referral-invoices'].collection
  const tests = payload.db.collections['drug-tests'].collection
  let linked = 0
  for await (const invoice of invoices.find({ status: 'sent' }, { session })) {
    for (const item of invoice.items || []) {
      if (!item.drugTest) continue
      const result = await tests.updateOne(
        { _id: item.drugTest, 'payment.balanceDue': { $gt: 0 } },
        { $set: { 'payment.status': 'invoiced', 'payment.referralInvoice': invoice._id } },
        { session },
      )
      linked += result.modifiedCount
    }
  }
  payload.logger.info(`Linked ${linked} unpaid drug tests to sent referral invoices`)
}

export async function down({ payload }: MigrateDownArgs): Promise<void> {
  payload.logger.info('Referral invoice history backfill is intentionally not reversed')
}
