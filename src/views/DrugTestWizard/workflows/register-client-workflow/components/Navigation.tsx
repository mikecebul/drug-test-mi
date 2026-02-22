'use client'

import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, Check, Loader2 } from 'lucide-react'
import { withForm } from '@/blocks/Form/hooks/form'
import { useStore } from '@tanstack/react-form'
import { useQueryState, parseAsStringLiteral } from 'nuqs'
import { steps } from '../validators'
import { registerClientFormOpts } from '../shared-form'

export const RegisterClientNavigation = withForm({
  ...registerClientFormOpts,
  props: {
    onBack: (): void => {},
  },

  render: function Render({ form, onBack }) {
    // Read step from URL (single source of truth)
    const [currentStepRaw, setCurrentStep] = useQueryState(
      'step',
      parseAsStringLiteral(steps as readonly string[]).withDefault('personalInfo'),
    )
    const currentStep = currentStepRaw as (typeof steps)[number]

    const isSubmitting = useStore(form.store, (state) => state.isSubmitting)
    const fieldMeta = useStore(form.store, (state) => state.fieldMeta)
    const noEmail = useStore(form.store, (state) => state.values.accountInfo.noEmail === true)

    const currentIndex = steps.indexOf(currentStep)
    const isFirstStep = currentIndex === 0
    const isLastStep = currentIndex === steps.length - 1

    // Check field-level errors for the current step only
    const currentStepHasErrors = noEmail && currentStep === 'accountInfo'
      ? false
      : Object.entries(fieldMeta).some(([fieldName, meta]) => {
          // Only check fields that belong to the current step
          if (!fieldName.startsWith(`${currentStep}.`)) return false
          // Check if this field has errors
          return meta?.errors && meta.errors.length > 0
        })

    const handleBack = () => {
      if (isFirstStep) {
        onBack()
      } else {
        const prevStep = steps[currentIndex - 1]
        if (prevStep) {
          setCurrentStep(prevStep, { history: 'push' })
        }
        form.validate('submit')
        form.setFieldMeta('accountInfo.email', (prev) => ({
          ...prev,
          errors: [],
          errorMap: {},
        }))
      }
    }

    return (
      <div className="mt-8 flex items-center justify-between border-t pt-4">
        <Button
          type="button"
          onClick={handleBack}
          variant="outline"
          disabled={isSubmitting}
          size="lg"
          data-testid="wizard-back-button"
        >
          <ChevronLeft className="mr-2 h-5 w-5" />
          {isFirstStep ? 'Cancel' : 'Back'}
        </Button>

        <Button type="submit" disabled={isSubmitting || currentStepHasErrors} size="lg" data-testid="wizard-next-button">
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Validating...
            </>
          ) : (
            <>
              {isLastStep ? 'Register Client' : 'Next'}
              {isLastStep ? <Check className="ml-2 h-5 w-5" /> : <ChevronRight className="ml-2 h-5 w-5" />}
            </>
          )}
        </Button>
      </div>
    )
  },
})
