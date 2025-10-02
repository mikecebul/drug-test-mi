import type { StripeWebhookHandler } from '@payloadcms/plugin-stripe/types'
import type Stripe from 'stripe'

export const invoicePaymentFailed: StripeWebhookHandler<{
  data: {
    object: Stripe.Invoice
  }
}> = async ({ event, payload, stripe }) => {
  const invoice = event.data.object

  payload.logger.info(`🪝 Processing invoice payment failed: ${invoice.id}`)

  try {
    // Validate required fields
    if (!invoice.id) {
      payload.logger.error('Invoice ID is missing from webhook event')
      return
    }

    if (!invoice.customer) {
      payload.logger.error(`Invoice ${invoice.id} has no customer ID`)
      return
    }

    // Retrieve full invoice details from Stripe to ensure we have subscription ID
    const fullInvoice = await stripe.invoices.retrieve(invoice.id)

    // Find the client by Stripe customer ID
    const clientsResult = await payload.find({
      collection: 'clients',
      where: {
        'recurringAppointments.stripeCustomerId': {
          equals: invoice.customer,
        },
      },
      limit: 1,
    })

    if (clientsResult.docs.length === 0) {
      payload.logger.error(`No client found with customer ID: ${invoice.customer}`)
      return
    }

    const client = clientsResult.docs[0]

    // Update subscription status to past_due
    await payload.update({
      collection: 'clients',
      id: client.id,
      data: {
        recurringAppointments: {
          ...client.recurringAppointments,
          subscriptionStatus: 'past_due',
        },
      },
    })

    // Check if payment record already exists
    const existingPayment = await payload.find({
      collection: 'payments',
      where: {
        stripeInvoiceId: {
          equals: invoice.id,
        },
      },
      limit: 1,
    })

    if (existingPayment.docs.length > 0) {
      payload.logger.info(`Payment record already exists for invoice: ${invoice.id}`)
      return
    }

    // Create payment record with failed status
    await payload.create({
      collection: 'payments',
      data: {
        stripeInvoiceId: invoice.id,
        relatedClient: client.id,
        stripeSubscriptionId: fullInvoice.subscription
          ? (fullInvoice.subscription as string)
          : undefined,
        amount: invoice.amount_due,
        status: 'failed',
        billingDate: new Date(invoice.created * 1000).toISOString(),
        invoicePdf: invoice.invoice_pdf || undefined,
      },
    })

    payload.logger.info(
      `✅ Updated client ${client.id} to past_due, created failed payment record`,
    )
  } catch (error) {
    payload.logger.error(`Error processing invoice.payment_failed webhook: ${error}`)
    throw error
  }
}
