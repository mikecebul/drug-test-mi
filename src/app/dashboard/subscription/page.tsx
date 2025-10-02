import { SubscriptionView } from './SubscriptionView'
import { getPayload } from 'payload'
import config from '@payload-config'
import { getAuthenticatedClient } from '@/utilities/auth/getAuthenticatedClient'

export const dynamic = 'force-dynamic'

export default async function SubscriptionPage() {
  const payload = await getPayload({ config })
  const client = await getAuthenticatedClient()

  // Fetch active subscription products
  const productsResult = await payload.find({
    collection: 'subscription-products',
    where: {
      isActive: {
        equals: true,
      },
    },
    sort: 'testsPerMonth',
  })

  // Fetch payment history for this client
  const paymentsResult = await payload.find({
    collection: 'payments',
    where: {
      relatedClient: {
        equals: client.id,
      },
    },
    sort: '-billingDate',
    limit: 50,
  })

  return (
    <SubscriptionView
      client={client}
      availableProducts={productsResult.docs}
      payments={paymentsResult.docs}
    />
  )
}
