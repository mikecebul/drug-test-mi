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
    const [currentStepRaw, setCurrentStep] = useQueryState(
      'step',
      parseAsStringLiteral(steps as readonly string[]).withDefault('upload'),
    )
    const currentStep = currentStepRaw as (typeof steps)[number]

    const isSubmitting = useStore(form.store, (state) => state.isSubmitting)
    const verifyData = useStore(form.store, (state) => state.values.verifyData)

    const currentIndex = steps.indexOf(currentStep)
    const isFirstStep = currentIndex === 0
    const isLastStep = currentIndex === steps.length - 1
    const verifyDataMissingDecision =
      currentStep === 'verifyData' &&
      group.state.meta.submissionAttempts > 0 &&
      verifyData.confirmationDecisionRequired &&
      !verifyData.confirmationDecision
    const verifyDataMissingSubstances =
      currentStep === 'verifyData' &&
      group.state.meta.submissionAttempts > 0 &&
      verifyData.confirmationDecision === 'request-confirmation' &&
      !verifyData.confirmationSubstances?.length
    const currentStepHasErrors =
      (group.state.meta.submissionAttempts > 0 && !group.state.meta.isValid) ||
      verifyDataMissingDecision ||
      verifyDataMissingSubstances

    const handleBack = () => {
      if (isFirstStep) {
        onBack()
      } else {
        const prevStep = steps[currentIndex - 1]
        setCurrentStep(prevStep, { history: 'push' })
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

        <Button
          type="button"
          disabled={isSubmitting || group.state.meta.isSubmitting || currentStepHasErrors}
          size="lg"
          onClick={() => group.handleSubmit()}
          data-testid="wizard-next-button"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Processing...
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
