import { getPayload } from 'payload'
import config from '@payload-config'
import { requireClientAuth } from '@/utilities/auth/requireClientAuth'
import { SubscriptionView } from './SubscriptionView'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export const dynamic = 'force-dynamic'

export default async function SubscriptionPage() {
  const client = await requireClientAuth()
  const payload = await getPayload({ config })

  // Find active enrollment
  const enrollmentResult = await payload.find({
    collection: 'orders',
    where: {
      and: [
        {
          customer: {
            equals: client.id,
          },
        },
      ],
    },
    sort: '-createdAt',
    limit: 1,
    depth: 2,
  })

  const enrollment = enrollmentResult.docs[0]

  // If no enrollment, show enrollment CTA
  if (!enrollment) {
    return (
      <div className="container mx-auto px-4 py-12 max-w-2xl">
        <div className="text-center space-y-6">
          <h1 className="text-3xl font-bold">No Active Subscription</h1>
          <p className="text-gray-600">
            You don't have an active testing subscription. Enroll now to get started with recurring
            drug testing.
          </p>
          <Button asChild size="lg">
            <Link href="/enroll">Enroll Now</Link>
          </Button>
        </div>
      </div>
    )
  }

  // Get upcoming tests
  const upcomingTestsResult = await payload.find({
    collection: 'drug-tests',
    where: {
      and: [
        {
          relatedClient: {
            equals: client.id,
          },
        },
        {
          enrollment: {
            equals: enrollment.id,
          },
        },
        {
          collectionDate: {
            greater_than: new Date().toISOString(),
          },
        },
      ],
    },
    sort: 'collectionDate',
    limit: 5,
    depth: 1,
  })

  // Get recent transactions
  const transactionsResult = await payload.find({
    collection: 'transactions',
    where: {
      customer: {
        equals: client.id,
      },
    },
    sort: '-createdAt',
    limit: 5,
  })

  return (
    <SubscriptionView
      enrollment={enrollment}
      upcomingTests={upcomingTestsResult.docs}
      transactions={transactionsResult.docs}
      client={client}
    />
  )
}
