'use client'

import { withFieldGroup, withForm } from '@/blocks/Form/hooks/form'
import { getRegisterClientFormOpts } from '../shared-form'

const AccountInfoFields = withFieldGroup({
  defaultValues: getRegisterClientFormOpts().defaultValues.accountInfo,

  render: function Render({ group }) {
    return (
      <div className="space-y-6">
        <div className="mb-6 flex items-center">
          <h2 className="text-foreground text-xl font-semibold">Account Info</h2>
        </div>

        <group.AppField name="email">
          {(field) => <field.EmailField label="Email Address" required />}
        </group.AppField>

        <group.AppField name="password">
          {(field) => <field.PasswordField label="Password" required autoComplete="new-password" />}
        </group.AppField>

        <group.AppField name="confirmPassword">
          {(field) => <field.PasswordField label="Confirm Password" required autoComplete="new-password" />}
        </group.AppField>
      </div>
    )
  },
})

export const AccountInfoStep = withForm({
  ...getRegisterClientFormOpts(),
  render: function Render({ form }) {
    return <AccountInfoFields form={form} fields="accountInfo" />
  },
})
