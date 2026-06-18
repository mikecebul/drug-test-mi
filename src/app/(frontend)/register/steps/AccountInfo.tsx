'use client'

import { withForm } from '@/blocks/Form/hooks/form'
import { revalidateLogic } from '@tanstack/react-form'
import { getRegisterClientFormOpts } from '../shared-form'
import { accountInfoSchema } from '../validators'
import { RegisterNavigation } from '../components/Navigation'
import { checkEmailExists } from '../actions'
import z from 'zod'
import { AccountPasswordFields } from './AccountPasswordFields'
import type { RegisterStepProps } from './types'

export const AccountInfoStep = withForm({
  ...getRegisterClientFormOpts(),
  props: {} as RegisterStepProps,
  render: function Render(props) {
    const { form } = props
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

    if (props.mode === 'body') {
      return body
    }

    return (
      <form.FormGroup
        name="accountInfo"
        validationLogic={revalidateLogic()}
        validators={{
          onDynamic: accountInfoSchema.shape.accountInfo,
        }}
        onGroupSubmit={() => props.onNext()}
        onGroupSubmitInvalid={() => props.onInvalid()}
      >
        {(group) => (
          <>
            {body}

            <RegisterNavigation
              isFirstStep={props.isFirstStep}
              isLastStep={props.isLastStep}
              isSubmitting={props.isSubmitting}
              isNextDisabled={group.state.meta.isSubmitting}
              onBack={() => props.onBack()}
              onNext={() => group.handleSubmit()}
            />
          </>
        )}
      </form.FormGroup>
    )
  },
})
