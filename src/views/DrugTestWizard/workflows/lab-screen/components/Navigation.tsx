'use client'

import { withForm } from '@/blocks/Form/hooks/form'
import { useStore } from '@tanstack/react-form'
import { parseAsStringLiteral, useQueryState } from 'nuqs'
import { Button } from '@/components/ui/button'
import { labScreenFormOpts, steps } from '../shared-form'

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

export const LabScreenNavigation = withForm({
  ...labScreenFormOpts,
  props: { onBack: (): void => {}, group: undefined as unknown as WorkflowGroup },

  render: function Render({ form, onBack, group }) {
    const [currentStep, setCurrentStep] = useQueryState(
      'step',
      parseAsStringLiteral(steps).withDefault('upload'),
    )

    const isSubmitting = useStore(form.store, (state) => state.isSubmitting)
    const currentStepIndex = steps.indexOf(currentStep)
    const isFirstStep = currentStepIndex === 0
    const isLastStep = currentStepIndex === steps.length - 1
    const nextDisabled = isSubmitting || group.state.meta.isSubmitting
    const handleBack = () => {
      if (isFirstStep) {
        onBack()
      } else {
        setCurrentStep(steps[currentStepIndex - 1], { history: 'push' })
      }
    }

    return (
      <div className="flex justify-between">
        <Button type="button" variant="outline" onClick={handleBack} disabled={isSubmitting} data-testid="wizard-back-button">
          {isFirstStep ? 'Cancel' : 'Back'}
        </Button>
        <Button
          type="button"
          onClick={() => group.handleSubmit()}
          disabled={nextDisabled}
          data-testid="wizard-next-button"
        >
          {isLastStep ? 'Update Test Record' : 'Next'}
        </Button>
      </div>
    )
  },
})
