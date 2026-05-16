'use client'

import { withForm } from '@/blocks/Form/hooks/form'
import { useStore } from '@tanstack/react-form'
import { parseAsStringLiteral, useQueryState } from 'nuqs'
import { Button } from '@/components/ui/button'
import { labConfirmationFormOpts, steps } from '../shared-form'

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

export const LabConfirmationNavigation = withForm({
  ...labConfirmationFormOpts,
  props: { onBack: (): void => {}, group: undefined as unknown as WorkflowGroup },

  render: function Render({ form, onBack, group }) {
    const [currentStepRaw, setCurrentStep] = useQueryState(
      'step',
      parseAsStringLiteral(steps as readonly string[]).withDefault('upload'),
    )
    const currentStep = currentStepRaw as (typeof steps)[number]

    const isSubmitting = useStore(form.store, (state) => state.isSubmitting)

    const currentStepIndex = steps.indexOf(currentStep)
    const isFirstStep = currentStepIndex === 0
    const isLastStep = currentStepIndex === steps.length - 1
    const currentStepHasErrors = group.state.meta.submissionAttempts > 0 && !group.state.meta.isValid

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
          disabled={currentStepHasErrors || isSubmitting || group.state.meta.isSubmitting}
          data-testid="wizard-next-button"
        >
          {isLastStep ? 'Update Test Record' : 'Next'}
        </Button>
      </div>
    )
  },
})
