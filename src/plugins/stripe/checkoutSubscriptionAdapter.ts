import type { PaymentAdapter } from '@payloadcms/plugin-ecommerce/types'
import type { GroupField } from 'payload'
import Stripe from 'stripe'
import { baseUrl } from '@/utilities/baseUrl'

export type StripeCheckoutSubscriptionAdapterArgs = {
  secretKey: string
  publishableKey: string
  webhookSecret: string
  label?: string
}

export const stripeCheckoutSubscriptionAdapter = (
  args: StripeCheckoutSubscriptionAdapterArgs,
): PaymentAdapter => {
  const { secretKey, publishableKey, webhookSecret, label } = args

  const stripe = new Stripe(secretKey, {
    apiVersion: '2025-09-30.clover',
  })

  return {
    name: 'stripe-checkout-subscription',
    label: label || 'Stripe Checkout (Subscription)',

    // Create Stripe Checkout Session for subscription
    initiatePayment: async ({ data, req, transactionsSlug = 'transactions' }) => {
      const payload = req.payload
      // Custom data fields not in default PaymentAdapter type
      const { productId, testingType, preferredDayOfWeek, preferredTimeSlot, customerEmail } =
        data as any

      try {
        // Get the product to retrieve price info
        const product = await payload.findByID({
          collection: 'products',
          id: productId as string,
        })

        if (!product) {
          throw new Error('Product not found')
        }

        // Get or create Stripe customer
        const customerId = req.user?.id

        let stripeCustomer: Stripe.Customer

        // Check if client already has a Stripe customer ID
        if (customerId && req.user?.collection === 'clients') {
          const client = await payload.findByID({
            collection: 'clients',
            id: customerId,
          })

          if (client?.recurringAppointments?.stripeCustomerId) {
            // Retrieve existing customer
            stripeCustomer = (await stripe.customers.retrieve(
              client.recurringAppointments.stripeCustomerId,
            )) as Stripe.Customer
          } else {
            // Create new customer
            stripeCustomer = await stripe.customers.create({
              email: customerEmail || client.email,
              name: `${client.firstName} ${client.lastName}`,
              metadata: {
                clientId: customerId,
              },
            })

            // Update client with Stripe customer ID
            await payload.update({
              collection: 'clients',
              id: customerId,
              data: {
                recurringAppointments: {
                  ...client.recurringAppointments,
                  stripeCustomerId: stripeCustomer.id,
                },
              },
            })
          }
        } else {
          // Guest checkout - create customer
          stripeCustomer = await stripe.customers.create({
            email: customerEmail,
          })
        }

        // Create Checkout Session in subscription mode
        const session = await stripe.checkout.sessions.create({
          mode: 'subscription',
          customer: stripeCustomer.id,
          line_items: [
            {
              price: product.stripePriceId,
              quantity: 1,
            },
          ],
          success_url: `${baseUrl}/enrollment/success?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${baseUrl}/enrollment/cancel`,
          metadata: {
            productId: productId as string,
            customerId: customerId || '',
            customerEmail: customerEmail || '',
            testingType: testingType || '',
            preferredDayOfWeek: preferredDayOfWeek || '',
            preferredTimeSlot: preferredTimeSlot || '',
          },
        })

        // Create transaction record (pending)
        const transaction = await payload.create({
          // @ts-expect-error - transactionsSlug is a valid collection
          collection: transactionsSlug,
          // @ts-expect-error - Custom transaction fields
          data: {
            status: 'processing',
            amount: session.amount_total || 0,
            currency: session.currency || 'usd',
            customer: customerId,
            paymentMethod: 'stripe-checkout-subscription',
            'stripe-checkout-subscription': {
              sessionId: session.id,
              customerId: stripeCustomer.id,
            },
          },
        })

        payload.logger.info(`Created checkout session: ${session.id}`)

        return {
          message: 'Checkout session created',
          checkoutUrl: session.url!,
          sessionId: session.id,
          transactionId: transaction.id,
        }
      } catch (error) {
        payload.logger.error('Error creating checkout session:', error)
        throw error
      }
    },

    // Confirm order (called from webhook after payment)
    // Custom confirmOrder implementation (type assertion needed for custom fields)
    confirmOrder: (async ({ data, ordersSlug = 'enrollments', req }) => {
      const payload = req.payload
      // Custom data fields
      const { subscriptionId, sessionId } = data as any

      try {
        // Retrieve subscription details
        const subscription = await stripe.subscriptions.retrieve(subscriptionId as string)
        const session = await stripe.checkout.sessions.retrieve(sessionId as string)

        // Get the product
        const product = await payload.findByID({
          collection: 'products',
          id: session.metadata?.productId || '',
        })

        // Create enrollment (order)
        const order = await payload.create({
          // ordersSlug is a valid collection
          collection: ordersSlug,
          // Custom order fields
          data: {
            customer: session.metadata?.customerId || null,
            customerEmail: session.customer_email,
            items: [
              {
                product: product.id,
                quantity: 1,
              },
            ],
            amount: subscription.items.data[0].plan.amount || 0,
            currency: subscription.currency,
            status: 'processing',
            stripeSubscriptionId: subscription.id,
            subscriptionStatus: subscription.status,
            testingType: session.metadata?.testingType || '',
            preferredDayOfWeek: session.metadata?.preferredDayOfWeek || null,
            preferredTimeSlot: session.metadata?.preferredTimeSlot || null,
          },
        })

        payload.logger.info(`Created enrollment: ${order.id} for subscription: ${subscription.id}`)

        return {
          message: 'Enrollment created',
          orderID: order.id,
          transactionID: session.metadata?.transactionId,
        }
      } catch (error) {
        payload.logger.error('Error confirming order:', error)
        throw error
      }
    }) as any,

    // Custom group for storing subscription data on transactions
    group: {
      name: 'stripe-checkout-subscription',
      type: 'group',
      fields: [
        {
          name: 'sessionId',
          type: 'text',
          label: 'Checkout Session ID',
          admin: {
            readOnly: true,
          },
        },
        {
          name: 'customerId',
          type: 'text',
          label: 'Stripe Customer ID',
          admin: {
            readOnly: true,
          },
        },
        {
          name: 'subscriptionId',
          type: 'text',
          label: 'Subscription ID',
          admin: {
            readOnly: true,
          },
        },
      ],
    } as GroupField,
  }
}
