import { getPayload } from 'payload'
import config from '@payload-config'
import { redirect } from 'next/navigation'
import { requireClientAuth } from '@/utilities/auth/requireClientAuth'
import { EnrollmentForm } from './EnrollmentForm'

export default async function EnrollPage() {
  // Require authentication
  const client = await requireClientAuth()

  // Fetch available products
  const payload = await getPayload({ config })
  const productsResult = await payload.find({
    collection: 'products',
    where: {
      _status: {
        equals: 'published',
      },
    },
    sort: 'createdAt',
  })

  // Check if client already has an active enrollment
  const existingEnrollments = await payload.find({
    collection: 'orders',
    where: {
      and: [
        {
          customer: {
            equals: client.id,
          },
        },
        {
          subscriptionStatus: {
            in: ['active', 'past_due'],
          },
        },
      ],
    },
    limit: 1,
  })

  // If already enrolled, redirect to dashboard
  if (existingEnrollments.docs.length > 0) {
    redirect('/dashboard/subscription')
  }

  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      <h1 className="text-4xl font-bold mb-4">Enroll in Testing Program</h1>
      <p className="text-lg text-gray-600 mb-8">
        Select a testing plan and preferences to get started with recurring drug testing.
      </p>

      <EnrollmentForm products={productsResult.docs} client={client} />
    </div>
  )
}
