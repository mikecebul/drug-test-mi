'use client'

import { withFieldGroup, withForm } from '@/blocks/Form/hooks/form'
import { getRegisterClientFormOpts } from '../shared-form'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Info } from 'lucide-react'
import { FieldGroupHeader } from '../../components/FieldGroupHeader'
import { useStore } from '@tanstack/react-form'

const AccountInfoFields = withFieldGroup({
  defaultValues: getRegisterClientFormOpts().defaultValues.accountInfo,

  render: function Render({ group }) {
    const noEmail = useStore(group.store, (state) => state.values.noEmail === true)

    return (
      <div className="space-y-6">
        <FieldGroupHeader title="Account Information" description="Email and login credentials" />

        <group.AppField name="noEmail">
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
        </group.AppField>

        {!noEmail && (
          <>
            <group.AppField name="email">
              {(field) => <field.EmailField label="Email Address" required />}
            </group.AppField>

            <group.AppField name="password">
              {(field) => <field.PasswordField label="Password" required autoComplete="new-password" />}
            </group.AppField>

            <group.AppField name="confirmPassword">
              {(field) => <field.PasswordField label="Confirm Password" required autoComplete="new-password" />}
            </group.AppField>
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
