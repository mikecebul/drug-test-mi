'use client'

import { withFieldGroup } from '@/blocks/Form/hooks/form'
import { getRegisterClientFormOpts } from '../shared-form'
import type { FormValues } from '../validators'

const AccountInfoFields = withFieldGroup<FormValues['accountInfo'], never>({
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

export function AccountInfoStep({ form }: { form: any }) {
  return (
    <AccountInfoFields
      form={form}
      fields={{
        email: 'accountInfo.email',
        password: 'accountInfo.password',
        confirmPassword: 'accountInfo.confirmPassword',
      } as never}
    />
  )
}
