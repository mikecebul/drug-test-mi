import type { Field } from 'payload'

/** Server-owned collection choice; native forms cannot reassign settled debt. */
export const billingResponsibilityField: Field = {
  name: 'billingResponsibility',
  type: 'group',
  admin: { readOnly: true, description: 'Who pays for this test. Set in the guided collection before payment.' },
  access: { create: () => false, update: () => false },
  fields: [
    {
      name: 'payer',
      type: 'select',
      options: [
        { label: 'Client', value: 'client' },
        { label: 'Referral', value: 'referral' },
      ],
    },
    { name: 'referral', type: 'relationship', relationTo: ['courts', 'employers'] },
    { name: 'paymentOperationId', type: 'text', admin: { hidden: true } },
    { name: 'changedAt', type: 'date' },
    { name: 'changedBy', type: 'relationship', relationTo: 'admins' },
  ],
}
