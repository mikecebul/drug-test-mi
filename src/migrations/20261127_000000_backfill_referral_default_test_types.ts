import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-mongodb'

const defaultTestType = '11-panel-lab'
const blank = { $in: [null, ''] }

export async function up({ payload, session }: MigrateUpArgs): Promise<void> {
  const clients = payload.db.collections.clients.collection
  let referralsUpdated = 0
  let clientsUpdated = 0

  for (const slug of ['courts', 'employers'] as const) {
    const referrals = payload.db.collections[slug].collection
    for await (const referral of referrals.find({ preferredTestType: blank }, { projection: { _id: 1 }, session })) {
      const updated = await referrals.updateOne(
        { _id: referral._id, preferredTestType: blank },
        { $set: { preferredTestType: defaultTestType } },
        { session },
      )
      if (updated.modifiedCount === 0) continue

      // Fill the linked client default used by booking jobs without overwriting an existing selection.
      const linked = await clients.updateMany(
        {
          'referral.relationTo': slug,
          'referral.value': referral._id,
          defaultTestType: blank,
        },
        { $set: { defaultTestType } },
        { session },
      )
      referralsUpdated += updated.modifiedCount
      clientsUpdated += linked.modifiedCount
    }
  }

  payload.logger.info(
    `Backfilled 11-Panel Lab defaults for ${referralsUpdated} referrals and ${clientsUpdated} clients`,
  )
}

export async function down({ payload }: MigrateDownArgs): Promise<void> {
  payload.logger.info('Referral default test backfill is intentionally not reversed')
}
