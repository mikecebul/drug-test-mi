import { getPayload } from 'payload'
import config from '@payload-config'
import { requireClientAuth } from '@/utilities/auth/requireClientAuth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { CheckCircle } from 'lucide-react'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-09-30.clover',
})

interface SuccessPageProps {
  searchParams: Promise<{ session_id?: string }>
}

export default async function EnrollmentSuccessPage({ searchParams }: SuccessPageProps) {
  const client = await requireClientAuth()
  const { session_id } = await searchParams

  if (!session_id) {
    redirect('/dashboard')
  }

  const payload = await getPayload({ config })

  // Create enrollment after successful checkout
  // Check if enrollment already exists for this session
  try {
    const session = await stripe.checkout.sessions.retrieve(session_id)

    if (session.subscription) {
      const subscription = await stripe.subscriptions.retrieve(session.subscription as string)

      // Check if order already exists
      const existingOrders = await payload.find({
        collection: 'orders',
        where: {
          stripeSubscriptionId: {
            equals: subscription.id,
          },
        },
        limit: 1,
      })

      // Create enrollment if it doesn't exist
      if (existingOrders.docs.length === 0) {
        const clientId = session.metadata?.clientId
        const productId = session.metadata?.productId

        if (clientId && productId) {
          await payload.create({
            collection: 'orders',
            data: {
              customer: clientId,
              customerEmail: session.customer_email || undefined,
              items: [
                {
                  product: productId,
                  quantity: 1,
                },
              ],
              amount: subscription.items.data[0].plan.amount || 0,
              currency: 'USD' as const,
              status: 'processing',
              stripeSubscriptionId: subscription.id,
              subscriptionStatus: subscription.status as any,
              testingType: (session.metadata?.testingType || 'random-1x') as any,
              preferredDayOfWeek: (session.metadata?.preferredDay || null) as any,
              preferredTimeSlot: (session.metadata?.preferredTimeSlot || null) as any,
            },
          })

          // Update client record
          await payload.update({
            collection: 'clients',
            id: clientId,
            data: {
              recurringAppointments: {
                isRecurring: true,
                stripeSubscriptionId: subscription.id,
                subscriptionStatus: subscription.status as any,
                subscriptionStartDate: new Date().toISOString(),
              },
            },
          })
        }
      }
    }
  } catch (error) {
    console.error('Error creating enrollment:', error)
  }

  // Find the enrollment (created either here or by webhook)
  const enrollmentResult = await payload.find({
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
            in: ['active', 'trialing', 'incomplete'],
          },
        },
      ],
    },
    sort: '-createdAt',
    limit: 1,
  })

  const enrollment = enrollmentResult.docs[0]

  return (
    <div className="container mx-auto px-4 py-12 max-w-2xl">
      <div className="text-center space-y-6">
        <div className="flex justify-center">
          <CheckCircle className="w-16 h-16 text-green-500" />
        </div>

        <h1 className="text-4xl font-bold">Enrollment Successful!</h1>

        <p className="text-lg text-gray-600">
          Thank you for enrolling in our testing program. Your subscription is now active.
        </p>

        {enrollment && (
          <div className="bg-gray-50 rounded-lg p-6 text-left space-y-4">
            <h2 className="text-xl font-semibold">Enrollment Details</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Testing Type:</span>
                <span className="font-medium">
                  {enrollment.testingType === 'fixed-saturday' && 'Fixed Saturday 11:10 AM'}
                  {enrollment.testingType === 'random-1x' && 'Random 1x/week'}
                  {enrollment.testingType === 'random-2x' && 'Random 2x/week'}
                </span>
              </div>
              {enrollment.testingType !== 'fixed-saturday' && (
                <>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Preferred Day:</span>
                    <span className="font-medium capitalize">{enrollment.preferredDayOfWeek}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Preferred Time:</span>
                    <span className="font-medium capitalize">
                      {enrollment.preferredTimeSlot?.replace('-', ' ')}
                    </span>
                  </div>
                </>
              )}
              <div className="flex justify-between">
                <span className="text-gray-600">Status:</span>
                <span className="font-medium capitalize text-green-600">
                  {enrollment.subscriptionStatus}
                </span>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-4">
          <h3 className="text-lg font-semibold">What's Next?</h3>
          <ul className="text-left space-y-2 text-gray-600">
            <li>✓ You'll receive an email confirmation shortly</li>
            <li>✓ Your first test will be scheduled automatically</li>
            <li>✓ You'll receive notifications before each test</li>
            <li>✓ View your schedule and results in your dashboard</li>
          </ul>
        </div>

        <div className="flex gap-4 justify-center pt-4">
          <Button asChild>
            <Link href="/dashboard">Go to Dashboard</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/dashboard/subscription">Manage Subscription</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
