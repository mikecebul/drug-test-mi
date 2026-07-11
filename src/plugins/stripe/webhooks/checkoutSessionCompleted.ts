import type { StripeWebhookHandler } from '@payloadcms/plugin-stripe/types'
import type Stripe from 'stripe'
import { APIError } from 'payload'
import { applyIncomingPayment, readRelationshipId } from '@/collections/Payments/services/applyPayment'
import type { Payment } from '@/payload-types'
import { withPayloadTransaction } from '@/collections/Payments/services/withPayloadTransaction'
import {
  findCalcomBookingForStripeSession,
  recordCalcomStripeCheckoutPayment,
} from '@/collections/Payments/services/calcomBookingPayment'

export const checkoutSessionCompleted: StripeWebhookHandler<{
  data: {
    object: Stripe.Checkout.Session
  }
}> = async ({ event, payload }) => {
  const {
    id: sessionId,
    metadata,
    amount_total,
    client_reference_id,
    created,
    payment_intent,
    payment_status,
  } = event.data.object
  const paymentId = metadata?.paymentId
  const submissionId = metadata?.submissionId
  const stripePaymentIntentId =
    typeof payment_intent === 'string'
      ? payment_intent
      : typeof payment_intent?.id === 'string'
        ? payment_intent.id
        : null

  payload.logger.info(`🪝 Processing checkout session completed for session ID: ${sessionId}`)

  if (paymentId) {
    if (payment_status !== 'paid') {
      payload.logger.info(`Stripe checkout session ${sessionId} completed without paid status: ${payment_status}`)
      return
    }

    await withPayloadTransaction(payload, async (req) => {
      const payment = (await payload.findByID({
        collection: 'payments',
        id: paymentId,
        depth: 0,
        overrideAccess: true,
        req,
      })) as Payment

      if (payment.status === 'posted') {
        payload.logger.info(`Stripe payment ${paymentId} is already posted`)
        return
      }

      if (payment.status === 'voided' || payment.status === 'refunded') {
        payload.logger.info(`Stripe payment ${paymentId} is ${payment.status} and will not be posted`)
        return
      }

      const clientId = readRelationshipId(payment.relatedClient)
      if (!clientId) {
        throw new APIError(`No client found for Stripe payment ${paymentId}`)
      }

      await applyIncomingPayment({
        payload,
        existingPaymentId: paymentId,
        clientId,
        amount: typeof amount_total === 'number' ? amount_total / 100 : payment.amount,
        method: 'stripe',
        source: 'stripe-checkout',
        relatedDrugTest: readRelationshipId(payment.relatedDrugTest),
        relatedBooking: readRelationshipId(payment.relatedBooking),
        stripeCheckoutSessionId: sessionId,
        stripePaymentIntentId: stripePaymentIntentId || payment.stripePaymentIntentId,
        stripeCheckoutUrl: payment.stripeCheckoutUrl,
        paymentLinkEmailSentAt: payment.paymentLinkEmailSentAt,
        req,
      })
    })

    return
  }

  if (!submissionId) {
    if (payment_status !== 'paid') {
      payload.logger.info(`Stripe checkout session ${sessionId} completed without paid status: ${payment_status}`)
      return
    }

    const amount = typeof amount_total === 'number' ? amount_total / 100 : 0
    const booking = await findCalcomBookingForStripeSession(payload, {
      metadata,
      clientReferenceId: client_reference_id,
      stripeCheckoutSessionId: sessionId,
      stripePaymentIntentId,
    })

    if (!booking) {
      payload.logger.info(`Stripe checkout session ${sessionId} did not match an app payment or Cal.com booking`)
      return
    }

    await withPayloadTransaction(payload, async (req) => {
      await recordCalcomStripeCheckoutPayment({
        payload,
        booking,
        amount,
        stripeCheckoutSessionId: sessionId,
        stripePaymentIntentId,
        collectedAt: typeof created === 'number' ? new Date(created * 1000).toISOString() : new Date().toISOString(),
        req,
      })
    })

    return
  }

  // Update this after creating a Registration Form and Collection
  //
  // if (payment_status === 'paid') {
  //   try {
  //     await payload.update({
  //       collection: 'form-submissions',
  //       id: submissionId,
  //       data: {
  //         payment: {
  //           status: 'paid',
  //         },
  //       },
  //     })
  //   } catch (error) {
  //     throw new APIError(`Error updating submission: ${error}`)
  //   }

  //   try {
  //     const submission = await payload.findByID({
  //       collection: 'form-submissions',
  //       id: submissionId,
  //     })

  //     const form = await payload.findByID({
  //       collection: 'forms',
  //       id: typeof submission.form === 'string' ? submission.form : submission.form.id,
  //     })
  //     const { emails } = form

  //     emails?.map(async (email) => {
  //       await payload.sendEmail({
  //         to: email.emailTo,
  //         cc: email.cc,
  //         bcc: email.bcc,
  //         replyTo: email.replyTo,
  //         from: email.emailFrom,
  //         subject: `Payment Confirmed from ${submission.title}`,
  //         html: `
  //           <h2>Payment Confirmation</h2>
  //           <p>A payment has been successfully processed for submission: ${submission.title}</p>
  //           <hr/>
  //           <h3>Payment Details:</h3>
  //           <ul>
  //             <li>Amount: $${amount_total ? (amount_total / 100).toFixed(2) : '0.00'}</li>
  //             <li>Status: ${payment_status}</li>
  //             <li>Session ID: ${sessionId}</li>
  //           </ul>
  //           <hr/>
  //           <p>Submission ID: ${submissionId}</p>
  //           <p><small>This is an automated message.</small></p>
  //         `,
  //       })
  //     })
  //   } catch (error) {
  //     throw new APIError(`Error sending email: ${error}`)
  //   }
  // }
}

// This appears to be old code that was not used in the final implementation.
//
// try {
//   const submission = await payload.findByID({
//     collection: 'form-submissions',
//     id: submissionId,
//   })

//   const enhancedSubmissionData = {
//     ...JSON.parse(JSON.stringify(submission.submissionData)),
//     paymentStatus: payment_status,
//     amount: amount_total ? `$${amount_total / 100}` : '$0.00',
//   }

//   await sendPaymentConfirmationEmail({
//     submission,
//     enhancedSubmissionData,
//     payment_status,
//     payload,
//   })
// } catch (error) {
//   throw new APIError(`Error sending confirmation email: ${error}`)
// }
// async function sendPaymentConfirmationEmail({
//   submission,
//   enhancedSubmissionData,
//   payment_status,
//   payload,
// }) {
//   const message = {
//     root: {
//       children: [
//         {
//           children: [
//             {
//               text:
//                 payment_status === 'paid'
//                   ? '✅ Payment Successfully Processed!'
//                   : '❌ Payment Failed',
//               version: 1,
//             },
//           ],
//           type: 'p',
//           version: 1,
//         },
//       ],
//       direction: null,
//       format: 'left' as const,
//       indent: 0,
//       type: 'root',
//       version: 1,
//     },
//   }

//   const html = await serializeLexical(message, enhancedSubmissionData)
//   const form = await payload.findByID({
//     id: typeof submission.form === 'string' ? submission.form : submission.form.id,
//     collection: 'forms',
//   })

//   if (form.emails?.length) {
//     const firstEmail = form.emails[0]
//     await payload.sendEmail({
//       to: firstEmail.emailTo,
//       cc: firstEmail.cc,
//       bcc: firstEmail.bcc,
//       replyTo: firstEmail.replyTo,
//       from: firstEmail.emailFrom,
//       subject: payment_status === 'paid' ? 'Payment Confirmed' : 'Payment Failed',
//       html,
//     })
//   }
// }
