'use client'

import { withForm } from '@/blocks/Form/hooks/form'
import { useStore } from '@tanstack/react-form'
import { useQueryState, parseAsStringLiteral } from 'nuqs'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, Check, Loader2 } from 'lucide-react'
import { instantTestFormOpts } from '../shared-form'
import { steps } from '../validators'
import { useWizardSession } from '@/views/DrugTestWizard/components/main-wizard/WizardSessionGuard'

type WorkflowGroup = {
  state: {
    meta: {
      isSubmitting: boolean
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
    const { isCheckingSession, requireActiveSession } = useWizardSession()
    const [currentStep, setCurrentStep] = useQueryState(
      'step',
      parseAsStringLiteral(steps).withDefault('upload'),
    )

    const isSubmitting = useStore(form.store, (state) => state.isSubmitting)
    const currentIndex = steps.indexOf(currentStep)
    const isFirstStep = currentIndex === 0
    const isLastStep = currentIndex === steps.length - 1
    const nextDisabled = isSubmitting || group.state.meta.isSubmitting || isCheckingSession
    const handleBack = () => {
      if (isFirstStep) {
        onBack()
      } else {
        const prevStep = steps[currentIndex - 1]
        setCurrentStep(prevStep, { history: 'push' })
      }
    }
    const handleNext = async () => {
      if (!(await requireActiveSession())) return
      await group.handleSubmit()
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
          disabled={nextDisabled}
          size="lg"
          onClick={() => void handleNext()}
          data-testid="wizard-next-button"
        >
          {isSubmitting || isCheckingSession ? (
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
