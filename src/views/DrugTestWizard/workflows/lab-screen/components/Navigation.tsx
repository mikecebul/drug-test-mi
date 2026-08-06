'use client'

import { withForm } from '@/blocks/Form/hooks/form'
import { useStore } from '@tanstack/react-form'
import { parseAsStringLiteral, useQueryState } from 'nuqs'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'
import { labScreenFormOpts, steps } from '../shared-form'

type WorkflowGroup = {
  state: {
    meta: {
      isSubmitting: boolean
      isValidating: boolean
      canSubmit: boolean
      isValid: boolean
      submissionAttempts: number
    }
  }
  handleSubmit: () => void | Promise<void>
}

export const LabScreenNavigation = withForm({
  ...labScreenFormOpts,
  props: { onBack: (): void => {}, group: undefined as unknown as WorkflowGroup },

  render: function Render({ form, onBack, group }) {
    const [currentStep, setCurrentStep] = useQueryState('step', parseAsStringLiteral(steps).withDefault('upload'))

    const isSubmitting = useStore(form.store, (state) => state.isSubmitting)
    const isValidating = useStore(form.store, (state) => state.isValidating)
    const currentStepIndex = steps.indexOf(currentStep)
    const isFirstStep = currentStepIndex === 0
    const isLastStep = currentStepIndex === steps.length - 1
    const isBusy = isSubmitting || isValidating || group.state.meta.isSubmitting || group.state.meta.isValidating
    const handleBack = () => {
      if (isFirstStep) {
        onBack()
      } else {
        setCurrentStep(steps[currentStepIndex - 1], { history: 'push' })
      }
    }

    return (
      <div
        className="bg-background/95 supports-[backdrop-filter]:bg-background/80 sticky bottom-0 z-20 -mx-2 mt-8 flex items-center justify-between gap-3 border-t px-2 py-4 backdrop-blur sm:-mx-4 sm:px-4"
        data-testid="wizard-navigation"
      >
        <Button type="button" variant="outline" onClick={handleBack} disabled={isBusy} data-testid="wizard-back-button">
          {isFirstStep ? 'Cancel' : 'Back'}
        </Button>
        <Button
          type="button"
          onClick={() => group.handleSubmit()}
          disabled={isBusy}
          aria-busy={isBusy}
          data-testid="wizard-next-button"
        >
          {isBusy ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              {isLastStep ? 'Updating test...' : 'Checking...'}
            </>
          ) : isLastStep ? (
            'Update Test Record'
          ) : (
            'Next'
          )}
        </Button>
      </div>
    )
  },
})
