import type { MCPPluginConfig } from '@payloadcms/plugin-mcp'
import { Forbidden, type PayloadRequest } from 'payload'
import Stripe from 'stripe'
import { z } from 'zod/v3'

import { bundleInput, previewBundle } from '@/collections/Payments/services/bundledCheckout/charges'
import { sendBundle, sendBundleInput } from '@/collections/Payments/services/bundledCheckout/checkout'

export const clientPaymentToolNames = ['previewClientPayment', 'sendClientPayment'] as const

function requireBillingAdmin(req: PayloadRequest) {
  if (req.user?.collection !== 'admins' || req.user.role !== 'superAdmin') throw new Forbidden()
}

function toolResult(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data) }] }
}

type PaymentTool = NonNullable<NonNullable<MCPPluginConfig['mcp']>['tools']>[number]

// The plugin depends on Zod 3. The app imports the compatible Zod 3 entry point from Zod 4.
function mcpParameters(schema: z.ZodRawShape) {
  return schema as unknown as PaymentTool['parameters']
}

export const clientPaymentTools: PaymentTool[] = [
  {
    name: clientPaymentToolNames[0],
    description:
      'Preview an itemized one-time client payment for explicit test IDs and amounts in cents. Use screen for an outstanding screen, confirmation for an existing fee, or new-confirmation for an explicitly authorized fee on a paid screen. New fees are recorded when Stripe confirms payment. This does not send anything.',
    parameters: mcpParameters(bundleInput),
    handler: async (args, req) => {
      requireBillingAdmin(req)
      const { clientId, charges } = z.object(bundleInput).parse(args)
      return toolResult(await previewBundle(req, clientId, charges))
    },
  },
  {
    name: clientPaymentToolNames[1],
    description:
      'Create one Stripe Checkout link for the exact charges in previewClientPayment and email it to the verified account email. Call only when the user has authorized sending that payment request. Use the same request ID when retrying. Use findPayments with the returned paymentId to check posting.',
    parameters: mcpParameters(sendBundleInput),
    handler: async (args, req) => {
      requireBillingAdmin(req)
      const input = z.object(sendBundleInput).parse(args)
      const key = process.env.STRIPE_SECRET_KEY
      if (!key || (process.env.NODE_ENV === 'production' && (!process.env.RESEND_API_KEY || !process.env.STRIPE_WEBHOOKS_ENDPOINT_SECRET))) {
        throw new Error('Stripe Checkout, its webhook, and Resend must be configured to send payments in production.')
      }
      return toolResult(await sendBundle(req, input, new Stripe(key, { timeout: 15_000, maxNetworkRetries: 1 })))
    },
  },
]
