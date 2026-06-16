'use client'

import { withForm } from '@/blocks/Form/hooks/form'
import { revalidateLogic } from '@tanstack/react-form'
import { getRegisterClientFormOpts } from '../shared-form'
import { termsSchema } from '../validators'
import { RegisterNavigation } from '../components/Navigation'
import type { RegisterStepProps } from './types'

export const TermsStep = withForm({
  ...getRegisterClientFormOpts(),
  props: {} as RegisterStepProps,
  render: function Render(props) {
    const { form } = props
    const body = (
      <div className="wizard-content mb-8 flex-1 space-y-6">
        <div className="flex items-center mb-6">
          <h2 className="text-xl font-semibold text-foreground">Terms & Conditions</h2>
        </div>

        <div className="bg-muted rounded-lg border border-border p-6">
          <h3 className="font-semibold text-foreground mb-3">Service Agreement</h3>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>By agreeing to these terms, you acknowledge that:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>All information provided is accurate and complete</li>
              <li>You consent to the drug screening procedure</li>
              <li>Test results will be shared with the designated recipient</li>
              <li>You understand the testing process and timeline</li>
              <li>Payment is required before testing can be scheduled</li>
            </ul>
            <p className="mt-3">
              Additional terms and conditions apply. Full documentation will be provided at the testing facility.
            </p>
          </div>
        </div>

        <form.AppField name="terms.agreeToTerms">
          {(field) => (
            <div>
              <label className="flex items-start">
                <input
                  type="checkbox"
                  name={field.name}
                  checked={field.state.value}
                  onChange={(e) => field.handleChange(e.target.checked)}
                  className="w-5 h-5 text-primary border-border rounded focus:ring-primary mt-1"
                />
                <span className="ml-3 text-sm text-foreground">
                  I have read and agree to the terms and conditions of service
                </span>
              </label>
              {field.state.meta.errors && (
                <em className="text-destructive text-sm first:mt-2">
                  {typeof field.state.meta.errors[0] === 'string'
                    ? field.state.meta.errors[0]
                    : (field.state.meta.errors[0] as { message?: string } | undefined)?.message}
                </em>
              )}
            </div>
          )}
        </form.AppField>
      </div>
    )

    if (props.mode === 'body') {
      return body
    }

    return (
      <form.FormGroup
        name="terms"
        validationLogic={revalidateLogic()}
        validators={{ onDynamic: termsSchema.shape.terms }}
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
