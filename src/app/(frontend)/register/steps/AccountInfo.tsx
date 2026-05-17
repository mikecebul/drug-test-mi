'use client'

import { withForm } from '@/blocks/Form/hooks/form'
import { revalidateLogic } from '@tanstack/react-form'
import { getRegisterClientFormOpts } from '../shared-form'
import { accountInfoSchema } from '../validators'
import { RegisterNavigation } from '../components/Navigation'
import { checkEmailExists } from '../actions'
import { getFirstGroupError } from '@/views/DrugTestWizard/workflows/form-group-errors'
import z from 'zod'
import { AccountPasswordFields } from './AccountPasswordFields'

export const AccountInfoStep = withForm({
  ...getRegisterClientFormOpts(),
  props: {} as {
    isFirstStep?: boolean
    isLastStep?: boolean
    isSubmitting?: boolean
    onBack?: () => void
    onNext?: () => void
    onInvalid?: () => void
  },
  render: function Render({ form, isFirstStep, isLastStep, isSubmitting, onBack, onNext, onInvalid }) {
    const body = (
      <div className="wizard-content mb-8 flex-1 space-y-6">
        <div className="mb-6 flex items-center">
          <h2 className="text-foreground text-xl font-semibold">Account Info</h2>
        </div>

        <form.AppField
          name="accountInfo.email"
          validators={{
            onSubmitAsync: async ({ value }) => {
              const normalizedEmail = value.trim().toLowerCase()
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

        <AccountPasswordFields form={form} fields="accountInfo" />
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
          onDynamic: accountInfoSchema.shape.accountInfo,
        }}
        onGroupSubmit={() => onNext?.()}
        onGroupSubmitInvalid={() => onInvalid?.()}
      >
        {(group) => (
          <>
            {body}

            {getFirstGroupError(group.state.meta.errors) || getFirstGroupError(group.state.meta.errorMap) ? (
              <div className="text-destructive mb-4 space-y-1 text-sm">
                <p>{getFirstGroupError(group.state.meta.errors) || getFirstGroupError(group.state.meta.errorMap)}</p>
              </div>
            ) : null}
            <RegisterNavigation
              isFirstStep={isFirstStep ?? false}
              isLastStep={isLastStep ?? false}
              isSubmitting={isSubmitting ?? false}
              isNextDisabled={!group.state.meta.canSubmit || group.state.meta.isSubmitting}
              onBack={() => onBack?.()}
              onNext={() => group.handleSubmit()}
            />
          </>
        )}
      </form.FormGroup>
    )
  },
})
