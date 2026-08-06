'use client'

import { withForm } from '@/blocks/Form/hooks/form'
import { useStore } from '@tanstack/react-form'
import { useQueryState, parseAsStringLiteral } from 'nuqs'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, Check, Loader2 } from 'lucide-react'
import { instantTestFormOpts } from '../shared-form'
import { steps } from '../validators'

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

export const InstantTestNavigation = withForm({
  ...instantTestFormOpts,
  props: {
    onBack: (): void => {},
    group: undefined as unknown as WorkflowGroup,
  },

  render: function Render({ form, onBack, group }) {
    const [currentStep, setCurrentStep] = useQueryState('step', parseAsStringLiteral(steps).withDefault('upload'))

    const isSubmitting = useStore(form.store, (state) => state.isSubmitting)
    const isValidating = useStore(form.store, (state) => state.isValidating)
    const currentIndex = steps.indexOf(currentStep)
    const isFirstStep = currentIndex === 0
    const isLastStep = currentIndex === steps.length - 1
    const isBusy = isSubmitting || isValidating || group.state.meta.isSubmitting || group.state.meta.isValidating
    const handleBack = () => {
      if (isFirstStep) {
        onBack()
      } else {
        const prevStep = steps[currentIndex - 1]
        setCurrentStep(prevStep, { history: 'push' })
      }
    }

    return (
      <div
        className="bg-background/95 supports-[backdrop-filter]:bg-background/80 sticky bottom-0 z-20 -mx-2 mt-8 flex items-center justify-between gap-3 border-t px-2 py-4 backdrop-blur sm:-mx-4 sm:px-4"
        data-testid="wizard-navigation"
      >
        <Button
          type="button"
          onClick={handleBack}
          variant="outline"
          disabled={isBusy}
          size="lg"
          data-testid="wizard-back-button"
        >
          <ChevronLeft className="mr-2 h-5 w-5" />
          {isFirstStep ? 'Cancel' : 'Back'}
        </Button>

        <Button
          type="button"
          disabled={isBusy}
          aria-busy={isBusy}
          size="lg"
          onClick={() => group.handleSubmit()}
          data-testid="wizard-next-button"
        >
          {isBusy ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              {isLastStep ? 'Creating drug test...' : 'Checking...'}
            </>
          ) : (
            <>
              {isLastStep ? 'Create Drug Test' : 'Next'}
              {isLastStep ? <Check className="ml-2 h-5 w-5" /> : <ChevronRight className="ml-2 h-5 w-5" />}
            </>
          )}
        </Button>
      </div>
    )
  },
})
