import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { getPayload } from 'payload'
import config from '@/payload.config'
import type { Client, Order } from '@/payload-types'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-09-30.clover',
})

const webhookSecret = process.env.STRIPE_WEBHOOKS_SIGNING_SECRET!

/**
 * Map Stripe subscription status to our supported statuses
 */
const mapSubscriptionStatus = (
  stripeStatus: Stripe.Subscription.Status,
  collection: 'clients' | 'orders',
): string => {
  // Common statuses
  if (['active', 'past_due', 'canceled', 'incomplete'].includes(stripeStatus)) {
    return stripeStatus
  }

  // Client-specific: unpaid
  if (collection === 'clients' && stripeStatus === 'unpaid') {
    return 'unpaid'
  }

  // Order-specific: paused (Stripe added this status later, may not be in all type versions)
  if (collection === 'orders' && stripeStatus === ('paused' as any)) {
    return 'paused'
  }

  // Map incomplete_expired and trialing to incomplete
  if (stripeStatus === 'incomplete_expired' || stripeStatus === 'trialing') {
    return 'incomplete'
  }

  // Map unpaid to canceled for orders (orders don't support unpaid status)
  if (collection === 'orders' && stripeStatus === 'unpaid') {
    return 'canceled'
  }

  // Default to incomplete for unknown statuses
  return 'incomplete'
}

export async function POST(req: NextRequest) {
  const payload = await getPayload({ config })
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')!

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret)
  } catch (err: any) {
    payload.logger.error(`Webhook signature verification failed: ${err.message}`)
    return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session

        // Only handle subscription mode checkouts
        if (session.mode !== 'subscription') {
          payload.logger.info('Skipping non-subscription checkout session')
          break
        }

        if (!session.subscription) {
          throw new Error('No subscription ID found in checkout session')
        }

        // Retrieve the subscription
        const subscription = await stripe.subscriptions.retrieve(session.subscription as string)

        // Get the product from metadata
        const productId = session.metadata?.productId

        if (!productId) {
          throw new Error('No productId found in session metadata')
        }

        // Create the enrollment (order)
        const enrollment = await payload.create({
          collection: 'orders',
          data: {
            customer: session.metadata?.customerId || null,
            customerEmail: session.customer_email || session.metadata?.customerEmail,
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
            subscriptionStatus: mapSubscriptionStatus(
              subscription.status,
              'orders',
            ) as Order['subscriptionStatus'],
            testingType: (session.metadata?.testingType ||
              'random-1x') as Order['testingType'],
            preferredDayOfWeek: (session.metadata?.preferredDayOfWeek ||
              null) as Order['preferredDayOfWeek'],
            preferredTimeSlot: (session.metadata?.preferredTimeSlot ||
              null) as Order['preferredTimeSlot'],
          },
        })

        // Update the client record with subscription info
        if (session.metadata?.customerId) {
          const client = await payload.findByID({
            collection: 'clients',
            id: session.metadata.customerId,
          })

          await payload.update({
            collection: 'clients',
            id: session.metadata.customerId,
            data: {
              recurringAppointments: {
                ...client.recurringAppointments,
                isRecurring: true,
                stripeSubscriptionId: subscription.id,
                subscriptionStatus: mapSubscriptionStatus(
                  subscription.status,
                  'clients',
                ) as 'active' | 'past_due' | 'canceled' | 'unpaid' | 'incomplete',
                subscriptionStartDate: new Date().toISOString(),
              },
            },
          })
        }

        payload.logger.info(`✅ Created enrollment ${enrollment.id} for subscription ${subscription.id}`)
        break
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription

        // Find the enrollment with this subscription ID
        const enrollments = await payload.find({
          collection: 'orders',
          where: {
            stripeSubscriptionId: {
              equals: subscription.id,
            },
          },
          limit: 1,
        })

        if (enrollments.docs.length === 0) {
          payload.logger.warn(`No enrollment found for subscription ${subscription.id}`)
          break
        }

        const enrollment = enrollments.docs[0]

        // Update enrollment status
        await payload.update({
          collection: 'orders',
          id: enrollment.id,
          data: {
            subscriptionStatus: mapSubscriptionStatus(
              subscription.status,
              'orders',
            ) as Order['subscriptionStatus'],
            status:
              subscription.status === 'active'
                ? 'processing'
                : subscription.status === 'canceled'
                  ? 'cancelled'
                  : enrollment.status,
          },
        })

        // Update client record if exists
        if (enrollment.customer) {
          const clientId =
            typeof enrollment.customer === 'string' ? enrollment.customer : enrollment.customer.id
          const client = await payload.findByID({
            collection: 'clients',
            id: clientId,
          })

          await payload.update({
            collection: 'clients',
            id: clientId,
            data: {
              recurringAppointments: {
                ...client.recurringAppointments,
                subscriptionStatus: mapSubscriptionStatus(
                  subscription.status,
                  'clients',
                ) as 'active' | 'past_due' | 'canceled' | 'unpaid' | 'incomplete',
              },
            },
          })
        }

        payload.logger.info(`✅ Updated enrollment ${enrollment.id} status to ${subscription.status}`)
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription

        // Find the enrollment with this subscription ID
        const enrollments = await payload.find({
          collection: 'orders',
          where: {
            stripeSubscriptionId: {
              equals: subscription.id,
            },
          },
          limit: 1,
        })

        if (enrollments.docs.length === 0) {
          payload.logger.warn(`No enrollment found for subscription ${subscription.id}`)
          break
        }

        const enrollment = enrollments.docs[0]

        // Update enrollment to cancelled
        await payload.update({
          collection: 'orders',
          id: enrollment.id,
          data: {
            subscriptionStatus: 'canceled',
            status: 'cancelled',
          },
        })

        // Update client record if exists
        if (enrollment.customer) {
          const clientId =
            typeof enrollment.customer === 'string' ? enrollment.customer : enrollment.customer.id
          const client = await payload.findByID({
            collection: 'clients',
            id: clientId,
          })

          await payload.update({
            collection: 'clients',
            id: clientId,
            data: {
              recurringAppointments: {
                ...client.recurringAppointments,
                isRecurring: false,
                subscriptionStatus: 'canceled' as const,
              },
            },
          })
        }

        payload.logger.info(`✅ Cancelled enrollment ${enrollment.id}`)
        break
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice

        // Only process for subscriptions
        if (!invoice.subscription) {
          payload.logger.info('Skipping non-subscription invoice')
          break
        }

        // Find the enrollment with this subscription ID
        const enrollments = await payload.find({
          collection: 'orders',
          where: {
            stripeSubscriptionId: {
              equals: invoice.subscription as string,
            },
          },
          limit: 1,
        })

        if (enrollments.docs.length === 0) {
          payload.logger.warn(`No enrollment found for subscription ${invoice.subscription}`)
          break
        }

        const enrollment = enrollments.docs[0]

        // Create transaction record
        const transaction = await payload.create({
          collection: 'transactions',
          data: {
            customer: enrollment.customer,
            amount: invoice.amount_paid,
            currency: 'USD' as const,
            status: 'succeeded',
            paymentMethod: 'stripe-checkout-subscription',
            'stripe-checkout-subscription': {
              subscriptionId: invoice.subscription as string,
              customerId: invoice.customer as string,
            },
            subscriptionPeriod: {
              periodStart: invoice.period_start
                ? new Date(invoice.period_start * 1000).toISOString()
                : null,
              periodEnd: invoice.period_end
                ? new Date(invoice.period_end * 1000).toISOString()
                : null,
            },
          },
        })

        payload.logger.info(`✅ Created transaction ${transaction.id} for invoice ${invoice.id}`)
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice

        // Only process for subscriptions
        if (!invoice.subscription) {
          payload.logger.info('Skipping non-subscription invoice')
          break
        }

        // Find the enrollment with this subscription ID
        const enrollments = await payload.find({
          collection: 'orders',
          where: {
            stripeSubscriptionId: {
              equals: invoice.subscription as string,
            },
          },
          limit: 1,
        })

        if (enrollments.docs.length === 0) {
          payload.logger.warn(`No enrollment found for subscription ${invoice.subscription}`)
          break
        }

        const enrollment = enrollments.docs[0]

        // Update enrollment status to past_due
        await payload.update({
          collection: 'orders',
          id: enrollment.id,
          data: {
            subscriptionStatus: 'past_due',
          },
        })

        // Update client record if exists
        if (enrollment.customer) {
          const clientId =
            typeof enrollment.customer === 'string' ? enrollment.customer : enrollment.customer.id
          const client = await payload.findByID({
            collection: 'clients',
            id: clientId,
          })

          await payload.update({
            collection: 'clients',
            id: clientId,
            data: {
              recurringAppointments: {
                ...client.recurringAppointments,
                subscriptionStatus: 'past_due' as
                  | 'active'
                  | 'past_due'
                  | 'canceled'
                  | 'unpaid'
                  | 'incomplete',
              },
            },
          })
        }

        payload.logger.info(`✅ Updated enrollment ${enrollment.id} to past_due status`)
        break
      }

      default:
        payload.logger.info(`Unhandled event type: ${event.type}`)
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    payload.logger.error(`Error processing webhook: ${error}`)
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 })
  }
}
