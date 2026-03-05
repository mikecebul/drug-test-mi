'use client'

import { withForm } from '@/blocks/Form/hooks/form'
import { useStore } from '@tanstack/react-form'
import { parseAsStringLiteral, useQueryState } from 'nuqs'
import { Button } from '@/components/ui/button'
import { labScreenFormOpts, steps } from '../shared-form'

export const LabScreenNavigation = withForm({
  ...labScreenFormOpts,
  props: { onBack: (): void => {} },

  render: function Render({ form, onBack }) {
    const [currentStep, setCurrentStep] = useQueryState(
      'step',
      parseAsStringLiteral(steps as readonly string[]).withDefault('upload'),
    )

    const [isSubmitting, errors] = useStore(form.store, (state) => [state.isSubmitting, state.errors])

    const currentStepIndex = steps.indexOf(currentStep as any)
    const isFirstStep = currentStepIndex === 0
    const isLastStep = currentStepIndex === steps.length - 1
    const isStepField = (fieldName: string, stepName: string) => fieldName === stepName || fieldName.startsWith(`${stepName}.`)

    // Determine if current step has errors
    const currentStepHasErrors = errors.some((errorObj) => {
      if (!errorObj) return false
      const fieldNames = Object.keys(errorObj)
      return fieldNames.some((fieldName) => isStepField(fieldName, currentStep))
    })

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
        <Button type="submit" disabled={currentStepHasErrors || isSubmitting} data-testid="wizard-next-button">
          {isLastStep ? 'Update Test Record' : 'Next'}
        </Button>
      </div>
    )
  },
})
