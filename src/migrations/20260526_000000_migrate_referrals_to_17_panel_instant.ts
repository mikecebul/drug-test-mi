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
  fromValue,
  toValue,
}: {
  payload: MigrateUpArgs['payload']
  collection: ReferralCollection
  fromTestTypeId: string | null
  fromValue: string
  toValue: string
}) {
  const fromValues = Array.from(new Set([fromTestTypeId, fromValue].filter((value): value is string => Boolean(value))))
  let updatedCount = 0
  const updatedIds = new Set<string>()

  for (const fromValueCandidate of fromValues) {
    const result = await payload.find({
      collection,
      where: {
        preferredTestType: {
          equals: fromValueCandidate,
        },
      },
      depth: 0,
      limit: 1000,
      overrideAccess: true,
    })

    for (const referral of result.docs) {
      const id = String(referral.id)
      if (updatedIds.has(id)) continue

      await payload.update({
        collection,
        id,
        data: {
          preferredTestType: toValue as never,
        },
        overrideAccess: true,
      })
      updatedIds.add(id)
      updatedCount++
    }
  }

  return updatedCount
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

  if (!fromTestTypeId) {
    payload.logger.info(`Referral preferred test migration did not find legacy ${fromValue} test type ID`)
  }

  let updatedCount = 0

  for (const collection of REFERRAL_COLLECTIONS) {
    updatedCount += await migrateReferralCollection({
      payload,
      collection,
      fromTestTypeId,
      fromValue,
      toValue,
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
