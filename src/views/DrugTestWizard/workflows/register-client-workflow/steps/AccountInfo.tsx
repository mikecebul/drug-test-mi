'use client'

import { withForm } from '@/blocks/Form/hooks/form'
import { getRegisterClientFormOpts } from '../shared-form'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Info } from 'lucide-react'
import { FieldGroupHeader } from '../../components/FieldGroupHeader'
import { revalidateLogic, useStore } from '@tanstack/react-form'
import { accountInfoOptionalEmailGroupSchema } from '../validators'
import { RegisterClientNavigation } from '../components/Navigation'
import { checkEmailExists } from '@/app/(frontend)/register/actions'
import z from 'zod'

export const AccountInfoStep = withForm({
  ...getRegisterClientFormOpts(),
  props: {} as {
    onBack?: () => void
    onNext?: () => void
    onInvalid?: (error: unknown) => void
  },
  render: function Render({ form, onBack, onNext, onInvalid }) {
    const noEmail = useStore(form.store, (state) => state.values.accountInfo.noEmail === true)
    const body = (
      <div className="wizard-content mb-8 flex-1 space-y-6">
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
            <form.AppField
              name="accountInfo.email"
              validators={{
                onSubmitAsync: async ({ value }) => {
                  const normalizedEmail = (value ?? '').trim().toLowerCase()
                  if (!normalizedEmail || !z.email().safeParse(normalizedEmail).success) {
                    return undefined
                  }

                  try {
                    const emailExists = await checkEmailExists(normalizedEmail)
                    if (emailExists) {
                      return 'An account with this email already exists'
                    }
                  } catch (error) {
                    console.warn('Failed to check email existence:', error)
                  }

                  return undefined
                },
              }}
            >
              {(field) => <field.EmailField label="Email Address" required />}
            </form.AppField>

            <form.AppField name="accountInfo.password">
              {(field) => <field.PasswordField label="Password" required autoComplete="new-password" />}
            </form.AppField>

            <form.AppField
              name="accountInfo.confirmPassword"
              validators={{
                onChangeListenTo: ['accountInfo.password'],
                onChange: ({ value, fieldApi }) => {
                  const password = fieldApi.form.getFieldValue('accountInfo.password')
                  if (password && value !== password) {
                    return { message: "Passwords don't match" }
                  }
                  return undefined
                },
              }}
            >
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
      </div>
    )

    if (!onNext) {
      return body
    }

    return (
      <form.FormGroup
        name="accountInfo"
        validationLogic={revalidateLogic()}
        validators={{
          onDynamic: ({ value }) => {
            const result = accountInfoOptionalEmailGroupSchema.safeParse(value)
            if (result.success) {
              return undefined
            }

            return {
              fields: Object.fromEntries(
                result.error.issues
                  .map((issue) => [issue.path[0], issue.message])
                  .filter(([fieldName]) => typeof fieldName === 'string'),
              ),
            }
          },
        }}
        onGroupSubmit={() => onNext?.()}
        onGroupSubmitInvalid={({ groupApi }) => onInvalid?.(groupApi.state.meta.errors)}
      >
        {(group) => (
          <>
            {body}
            <RegisterClientNavigation form={form} group={group} onBack={onBack ?? (() => {})} />
          </>
        )}
      </form.FormGroup>
    )
  },
})
