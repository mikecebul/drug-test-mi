import type { CollectionAfterChangeHook } from 'payload'

import { isTestTypeValue, type TestTypeValue } from '@/config/test-types'

type ReferralCollection = 'courts' | 'employers'

function normalizePreferredTestType(value: unknown): TestTypeValue | null {
  return isTestTypeValue(value) ? value : null
}

export function syncLinkedClientDefaultTestsFromReferral(relationTo: ReferralCollection): CollectionAfterChangeHook {
  return async ({ doc, operation, previousDoc, req }) => {
    if (operation !== 'update') return doc

    const defaultTestType = normalizePreferredTestType(doc.preferredTestType)
    const previousDefaultTestType = normalizePreferredTestType(previousDoc?.preferredTestType)

    if (defaultTestType === previousDefaultTestType) return doc

    let page = 1
    let totalPages = 1
    let updatedClients = 0

    do {
      const linkedClients = await req.payload.find({
        collection: 'clients',
        where: {
          and: [
            {
              'referral.relationTo': {
                equals: relationTo,
              },
            },
            {
              'referral.value': {
                equals: String(doc.id),
              },
            },
          ],
        },
        depth: 0,
        limit: 100,
        page,
        overrideAccess: true,
        req,
        select: {
          defaultTestType: true,
        },
      })

      totalPages = linkedClients.totalPages || 1

      for (const client of linkedClients.docs) {
        if (client.defaultTestType === defaultTestType) continue

        await req.payload.update({
          collection: 'clients',
          id: client.id,
          data: {
            defaultTestType,
          },
          overrideAccess: true,
          req,
        })
        updatedClients++
      }

      page++
    } while (page <= totalPages)

    req.payload.logger.info({
      msg: '[referrals] Synchronized linked client default tests after preferred test change',
      referralCollection: relationTo,
      referralId: String(doc.id),
      defaultTestType,
      updatedClients,
    })

    return doc
  }
}
