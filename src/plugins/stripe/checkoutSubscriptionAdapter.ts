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
          success_url: `${baseUrl}/dashboard/enrollment/success?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${baseUrl}/dashboard/enrollment/cancel`,
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

    // Confirm order - required by ecommerce plugin
    // This gets called after checkout, but we also use webhooks for redundancy
    confirmOrder: (async ({ data, ordersSlug = 'orders', req }) => {
      const payload = req.payload
      const { sessionId } = data as any

      try {
        payload.logger.info(`🔄 confirmOrder called with sessionId: ${sessionId}`)

        if (!sessionId) {
          throw new Error('No sessionId provided to confirmOrder')
        }

        // Retrieve the checkout session
        const session = await stripe.checkout.sessions.retrieve(sessionId as string)

        if (!session.subscription) {
          throw new Error('No subscription found in checkout session')
        }

        // Retrieve the subscription
        const subscription = await stripe.subscriptions.retrieve(session.subscription as string)

        // Get metadata
        const clientId = session.metadata?.clientId
        const productId = session.metadata?.productId

        if (!clientId || !productId) {
          throw new Error('Missing clientId or productId in session metadata')
        }

        // Check if order already exists (from webhook)
        const existingOrders = await payload.find({
          collection: ordersSlug,
          where: {
            stripeSubscriptionId: {
              equals: subscription.id,
            },
          },
          limit: 1,
        })

        if (existingOrders.docs.length > 0) {
          payload.logger.info(`✅ Order already exists (created by webhook): ${existingOrders.docs[0].id}`)
          return {
            message: 'Order already created by webhook',
            orderID: existingOrders.docs[0].id,
          }
        }

        // Create the order (same logic as webhook handler)
        payload.logger.info(`Creating order for client: ${clientId}, subscription: ${subscription.id}`)

        const order = await payload.create({
          collection: ordersSlug,
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
              isRecurring: true,
              stripeSubscriptionId: subscription.id,
              subscriptionStatus: subscription.status as any,
              subscriptionStartDate: new Date().toISOString(),
            },
          },
        })

        payload.logger.info(`✅ Order created via confirmOrder: ${order.id}`)

        return {
          message: 'Order created',
          orderID: order.id,
        }
      } catch (error) {
        payload.logger.error('❌ Error in confirmOrder:', error)
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
