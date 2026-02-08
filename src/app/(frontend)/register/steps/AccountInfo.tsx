'use client'

import { withForm } from '@/blocks/Form/hooks/form'
import { getRegisterClientFormOpts } from '../shared-form'

export const AccountInfoStep = withForm({
  ...getRegisterClientFormOpts('accountInfo'),

  render: function Render({ form }) {
    return (
      <div className="space-y-6">
        <div className="mb-6 flex items-center">
          <h2 className="text-foreground text-xl font-semibold">Account Info</h2>
        </div>

        <form.AppField name="accountInfo.email">
          {(field) => <field.EmailField label="Email Address" required />}
        </form.AppField>

        <form.AppField name="accountInfo.password">
          {(field) => <field.PasswordField label="Password" required autoComplete="new-password" />}
        </form.AppField>

        <form.AppField name="accountInfo.confirmPassword">
          {(field) => <field.PasswordField label="Confirm Password" required autoComplete="new-password" />}
        </form.AppField>
      </div>
    )
  },
})
