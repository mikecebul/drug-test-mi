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
    const noEmail = useStore(form.store, (state) => state.values.accountInfo.noEmail === true)

    return (
      <div className="space-y-6">
        <FieldGroupHeader title="Account Information" description="Email and login credentials" />

        <form.AppField name="accountInfo.noEmail">
          {(field) => (
            <div className="space-y-3">
              <label
                className={`hover:bg-accent/50 flex cursor-pointer items-center rounded-lg border-2 p-4 transition-all ${
                  noEmail ? 'border-primary bg-primary/10' : 'border-border'
                }`}
              >
                <input
                  type="checkbox"
                  name={field.name}
                  checked={noEmail === true}
                  onChange={(e) => field.handleChange(e.target.checked)}
                  className="text-primary border-border focus:ring-primary h-5 w-5"
                />
                <div className="ml-3">
                  <span className="text-foreground text-base font-medium">Client does not have an email address</span>
                  <p className="text-muted-foreground text-sm">
                    Skip this step. We will auto-generate a placeholder email and disable client result emails.
                  </p>
                </div>
              </label>
            </div>
          )}
        </form.AppField>

        {!noEmail && (
          <>
            <form.AppField name="accountInfo.email">
              {(field) => <field.EmailField label="Email Address" required />}
            </form.AppField>

            <form.AppField name="accountInfo.password">
              {(field) => <field.PasswordField label="Password" required autoComplete="new-password" />}
            </form.AppField>

            <form.AppField name="accountInfo.confirmPassword">
              {(field) => <field.PasswordField label="Confirm Password" required autoComplete="new-password" />}
            </form.AppField>
          </>
        )}

        <Alert variant="info">
          <Info />
          <AlertTitle>Password</AlertTitle>
          <AlertDescription className="text-sm">
            {noEmail
              ? 'This client will not receive login emails. A placeholder email will be generated automatically.'
              : 'Password is auto-generated but can be changed if the client requests a specific password.'}
          </AlertDescription>
        </Alert>
        {!noEmail && errors && errors.length > 0 && (
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
