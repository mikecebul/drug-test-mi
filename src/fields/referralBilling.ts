import type { Field } from 'payload'
const adminFieldAccess = ({ req }: { req: { user?: { collection?: string } | null } }) =>
  req.user?.collection === 'admins'

/** Billing is configured on an existing referral by an administrator. */
export const referralBillingFields: Field[] = [
  {
    type: 'collapsible',
    label: 'Monthly invoicing',
    fields: [
      {
        name: 'isBillable',
        type: 'checkbox',
        defaultValue: false,
        access: { create: adminFieldAccess, read: adminFieldAccess, update: adminFieldAccess },
        admin: {
          description: 'Send this referral monthly Stripe invoices for its clients’ unpaid drug tests.',
        },
      },
      {
        name: 'billingEmail',
        type: 'email',
        access: { create: adminFieldAccess, read: adminFieldAccess, update: adminFieldAccess },
        admin: {
          condition: (_, siblingData) => Boolean(siblingData?.isBillable),
          description: 'Stripe sends invoices to this address. This is separate from result notification contacts.',
        },
        validate: (value, { siblingData }) => {
          if (
            (siblingData as { isBillable?: boolean } | undefined)?.isBillable &&
            !(typeof value === 'string' && value.trim())
          ) {
            return 'Billing email is required when monthly invoicing is enabled.'
          }
          return true
        },
      },
      {
        name: 'stripeCustomerId',
        type: 'text',
        access: { create: adminFieldAccess, read: adminFieldAccess, update: adminFieldAccess },
        admin: {
          readOnly: true,
          condition: (_, siblingData) => Boolean(siblingData?.stripeCustomerId),
          description: 'Stripe customer linked to this referral.',
        },
      },
    ],
  },
]
