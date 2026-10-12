import type { Payload, PayloadRequest } from 'payload'
import { isTestBilledToReferral } from '@/lib/referral-invoices/payer'
import { getTestTypeLabel } from '@/config/test-types'
import { formatCollectionDate } from '@/lib/date-utils'

export async function clientBalances(payload: Payload, clientId: string, req: PayloadRequest) {
  let clientBalance = 0,
    referralBalance = 0
  const balances: Array<{ id: string; label: string; amount: number }> = []
  for (let page = 1; ; page++) {
    const result = await payload.find({
      collection: 'drug-tests',
      where: { and: [{ relatedClient: { equals: clientId } }, { 'payment.balanceDue': { greater_than: 0 } }] },
      sort: 'collectionDate',
      page,
      limit: 100,
      depth: 0,
      req,
      overrideAccess: false,
    })
    for (const test of result.docs) {
      const amount = test.payment?.balanceDue || 0
      if (
        test.payment?.status === 'invoiced' ||
        test.payment?.referralInvoice ||
        (await isTestBilledToReferral(payload, test, req))
      )
        referralBalance += amount
      else {
        clientBalance += amount
        balances.push({
          id: test.id,
          label: `${getTestTypeLabel(test.testType)} · ${formatCollectionDate(test.collectionDate || test.createdAt)}`,
          amount,
        })
      }
    }
    if (!result.hasNextPage) break
  }
  return {
    clientBalance: Math.round(clientBalance * 100) / 100,
    referralBalance: Math.round(referralBalance * 100) / 100,
    balances,
  }
}
