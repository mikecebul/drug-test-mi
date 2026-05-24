'use client'

import { withForm } from '@/blocks/Form/hooks/form'
import { getRegisterClientFormOpts } from '../shared-form'
import { SCREENING_TYPES } from '../types'
import { revalidateLogic, useStore } from '@tanstack/react-form'
import { screeningTypeSchema } from '../validators'
import { RegisterNavigation } from '../components/Navigation'
import type { RegisterStepProps } from './types'

export const ScreeningTypeStep = withForm({
  ...getRegisterClientFormOpts(),
  props: {} as RegisterStepProps,
  render: function Render(props) {
    const { form } = props
    const requestedBy = useStore(form.store, (state) => state.values.screeningType.requestedBy)
    const body = (
      <div className="wizard-content mb-8 flex-1 space-y-6">
        <div className="mb-6 flex items-center">
          <h2 className="text-foreground text-xl font-semibold">Screening Request</h2>
        </div>

        <p className="text-muted-foreground rounded-lg border border-border bg-muted/50 p-4 text-sm">
          MI Drug Test is introducing a 17-panel instant screen soon. Your referral will determine which test type is
          selected for your appointments.
        </p>

        <form.AppField name="screeningType.requestedBy">
          {(field) => (
            <div>
              <label className="text-foreground mb-4 block text-sm font-medium">
                Who is requesting this drug screening?
              </label>
              <div className="space-y-3">
                {SCREENING_TYPES.map((option) => (
                  <label
                    key={option.value}
                    className={`hover:bg-accent/50 flex cursor-pointer items-center rounded-lg border-2 p-4 transition-all ${
                      requestedBy === option.value ? 'border-primary bg-primary/10' : 'border-border'
                    }`}
                  >
                    <input
                      type="radio"
                      name={field.name}
                      value={option.value}
                      checked={requestedBy === option.value}
                      onChange={(e) => field.handleChange(e.target.value as (typeof SCREENING_TYPES)[number]['value'])}
                      className="text-primary border-border focus:ring-primary h-5 w-5"
                    />
                    <div className="ml-3">
                      <span className="text-foreground text-base font-medium">{option.label}</span>
                      <p className="text-muted-foreground text-sm">{option.description}</p>
                    </div>
                  </label>
                ))}
              </div>
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
        name="screeningType"
        validationLogic={revalidateLogic()}
        validators={{ onDynamic: screeningTypeSchema.shape.screeningType }}
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
