'use client'

import { withForm } from '@/blocks/Form/hooks/form'
import { getRegisterClientFormOpts } from '../shared-form'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Info } from 'lucide-react'
import { FieldGroupHeader } from '../../components/FieldGroupHeader'
import { useStore } from '@tanstack/react-form'

export const AccountInfoStep = withForm({
  ...getRegisterClientFormOpts('accountInfo'),

  render: function Render({ form }) {
    const errors = useStore(form.store, (state) => state.errors)

    return (
      <div className="space-y-6">
        <FieldGroupHeader title="Account Information" description="Email and login credentials" />

        <form.AppField name="accountInfo.email">
          {(field) => <field.EmailField label="Email Address" required />}
        </form.AppField>

        <form.AppField name="accountInfo.password">
          {(field) => <field.PasswordField label="Password" required autoComplete="new-password" />}
        </form.AppField>

        <form.AppField name="accountInfo.confirmPassword">
          {(field) => <field.PasswordField label="Confirm Password" required autoComplete="new-password" />}
        </form.AppField>

        <Alert variant="info">
          <Info />
          <AlertTitle>Password</AlertTitle>
          <AlertDescription className="text-muted-foreground text-sm">
            Password is auto-generated but can be changed if the client requests a specific password.
          </AlertDescription>
        </Alert>
        {errors && errors.length > 0 && (
          <div className="text-destructive text-sm">
            {errors.map((error, i) => (
              <div key={i}>{typeof error === 'string' ? error : null}</div>
            ))}
          </div>
        )}
      </div>
    )
  },
})
