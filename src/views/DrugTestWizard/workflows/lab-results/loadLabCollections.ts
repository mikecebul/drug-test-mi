import type { DrugTest } from '@/payload-types'
import type { Where } from 'payload'
import { sdk } from '@/lib/payload-sdk'
import { TEST_TYPES } from '@/config/test-types'
import { eligibleLabCollection, type ReportType } from './model'
import type { ParsedPDFData } from '../../types'

export type LabCollection = Pick<
  DrugTest,
  'id' | 'clientName' | 'testType' | 'collectionDate' | 'screeningStatus' | 'confirmationDecision' | 'relatedClient'
>

/** Fetch every eligible page before ranking, so older exact matches remain discoverable. */
export async function loadLabCollections(report: ParsedPDFData | undefined, type: ReportType) {
  const awaitingConfirmation: Where = {
    and: [
      { screeningStatus: { in: ['screened', 'confirmation-pending'] } },
      { confirmationDecision: { equals: 'request-confirmation' } },
    ],
  }
  const awaitingScreen: Where = {
    and: [
      { screeningStatus: { equals: 'collected' } },
      { testType: { in: TEST_TYPES.filter((type) => type.category === 'lab').map((type) => type.value) } },
    ],
  }
  const stages: Where =
    type === 'confirmation' || report?.reportKind === 'confirmation'
      ? awaitingConfirmation
      : type === 'screening' || report?.hasConfirmation !== true
        ? awaitingScreen
        : { or: [awaitingScreen, awaitingConfirmation] }
  const docs: DrugTest[] = []
  for (let page = 1; ; page++) {
    const result = await sdk.find({
      collection: 'drug-tests',
      depth: 1,
      populate: { clients: { firstName: true, middleInitial: true, lastName: true } },
      limit: 100,
      page,
      sort: ['-collectionDate', 'id'],
      select: {
        id: true,
        relatedClient: true,
        clientName: true,
        testType: true,
        collectionDate: true,
        screeningStatus: true,
        confirmationDecision: true,
      },
      where: stages,
    })
    docs.push(...result.docs)
    if (!result.hasNextPage) break
  }
  return docs
    .filter((test) => eligibleLabCollection(test, type, report))
    .map((test) => {
      const client = typeof test.relatedClient === 'object' ? test.relatedClient : null
      // The stored clientName can be stale after profile edits. Use the
      // collection's current client, with normal SDK access controls.
      return {
        ...test,
        clientName: client
          ? [client.firstName, client.middleInitial, client.lastName].filter(Boolean).join(' ')
          : test.clientName,
      }
    })
}
