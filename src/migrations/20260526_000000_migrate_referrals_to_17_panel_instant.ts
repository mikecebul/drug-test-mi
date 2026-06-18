import { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-mongodb'

const OLD_TEST_TYPE_VALUE = '15-panel-instant'
const NEW_TEST_TYPE_VALUE = '17-panel-instant'
const REFERRAL_COLLECTIONS = ['courts', 'employers'] as const

type ReferralCollection = (typeof REFERRAL_COLLECTIONS)[number]

async function findTestTypeId(payload: MigrateUpArgs['payload'], value: string): Promise<string | null> {
  const result = await payload.find({
    collection: 'test-types',
    where: {
      value: {
        equals: value,
      },
    },
    depth: 0,
    limit: 1,
    overrideAccess: true,
  })

  return result.docs[0]?.id ? String(result.docs[0].id) : null
}

async function migrateReferralCollection({
  payload,
  collection,
  fromTestTypeId,
  toTestTypeId,
}: {
  payload: MigrateUpArgs['payload']
  collection: ReferralCollection
  fromTestTypeId: string
  toTestTypeId: string
}) {
  const result = await payload.find({
    collection,
    where: {
      preferredTestType: {
        equals: fromTestTypeId,
      },
    },
    depth: 0,
    limit: 1000,
    overrideAccess: true,
  })

  for (const referral of result.docs) {
    await payload.update({
      collection,
      id: referral.id,
      data: {
        preferredTestType: toTestTypeId,
      },
      overrideAccess: true,
    })
  }

  return result.docs.length
}

async function migrateReferrals({
  payload,
  fromValue,
  toValue,
}: {
  payload: MigrateUpArgs['payload']
  fromValue: string
  toValue: string
}) {
  const fromTestTypeId = await findTestTypeId(payload, fromValue)
  const toTestTypeId = await findTestTypeId(payload, toValue)

  if (!fromTestTypeId) {
    payload.logger.info(`Referral preferred test migration skipped: ${fromValue} test type not found`)
    return
  }

  if (!toTestTypeId) {
    throw new Error(`Referral preferred test migration failed: ${toValue} test type not found`)
  }

  let updatedCount = 0

  for (const collection of REFERRAL_COLLECTIONS) {
    updatedCount += await migrateReferralCollection({
      payload,
      collection,
      fromTestTypeId,
      toTestTypeId,
    })
  }

  payload.logger.info(`Updated ${updatedCount} referral preferred test type(s) from ${fromValue} to ${toValue}`)
}

export async function up({ payload }: MigrateUpArgs): Promise<void> {
  await migrateReferrals({
    payload,
    fromValue: OLD_TEST_TYPE_VALUE,
    toValue: NEW_TEST_TYPE_VALUE,
  })
}

export async function down({ payload }: MigrateDownArgs): Promise<void> {
  await migrateReferrals({
    payload,
    fromValue: NEW_TEST_TYPE_VALUE,
    toValue: OLD_TEST_TYPE_VALUE,
  })
}
